import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'meme-tools'
export const inject = ['tools']

const MEMEGEN_TEMPLATES_URL = 'https://api.memegen.link/templates/'
const MEMEGEN_IMAGES_URL = 'https://api.memegen.link/images/'
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'
const MAX_RESULTS = 10
// Common words add noise to token matching without describing a meme concept.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'for', 'in', 'is', 'it', 'of', 'on', 'or', 'that',
  'the', 'this', 'to', 'with', 'you',
])

interface MemegenTemplate {
  id: string
  name: string
  blank: string
  keywords: string[]
}

interface MemegenImage {
  url: string
}

interface GiphyItem {
  id: string
  title: string
  images: {
    original: { url: string }
    fixed_width_small?: { url: string }
    fixed_width?: { url: string }
  }
}

function isMemegenTemplate(value: unknown): value is MemegenTemplate {
  // Treat API data as untrusted and keep only templates with the fields the tool uses.
  if (typeof value !== 'object' || value === null) return false

  const template = value as Record<string, unknown>
  return typeof template.id === 'string'
    && typeof template.name === 'string'
    && typeof template.blank === 'string'
    && Array.isArray(template.keywords)
    && template.keywords.every((keyword) => typeof keyword === 'string')
}

function isMemegenImage(value: unknown): value is MemegenImage {
  if (typeof value !== 'object' || value === null) return false

  return typeof (value as Record<string, unknown>).url === 'string'
}

function isGiphyItem(value: unknown): value is GiphyItem {
  if (typeof value !== 'object' || value === null) return false

  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.title !== 'string') return false
  if (typeof item.images !== 'object' || item.images === null) return false

  const images = item.images as Record<string, unknown>
  if (typeof images.original !== 'object' || images.original === null) return false
  return typeof (images.original as Record<string, unknown>).url === 'string'
}

function renditionUrl(item: GiphyItem, rendition: 'fixed_width_small' | 'fixed_width') {
  const candidate = item.images[rendition]
  return candidate?.url || item.images.original.url
}

function normalize(value: string) {
  // Normalize punctuation and casing so user phrases and template metadata are comparable.
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(value: string) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

function scoreTemplate(
  template: MemegenTemplate,
  query: string,
  intent: string,
  queryTokens: string[],
  intentTokens: string[],
) {
  const name = normalize(template.name)
  const id = normalize(template.id)
  const keywords = template.keywords.map(normalize)
  const searchableValues = [name, id, ...keywords]

  let score = 0
  // The explicit query describes what to find, so exact and phrase matches rank highest.
  if (query && name === query) score += 100
  else if (query && name.includes(query)) score += 50

  if (query && keywords.some((keyword) => keyword === query)) score += 80
  else if (query && keywords.some((keyword) => keyword.includes(query))) score += 40

  for (const token of queryTokens) {
    if (id === token) score += 20
    if (name.split(' ').includes(token)) score += 12
    else if (name.includes(token)) score += 6

    if (keywords.some((keyword) => keyword.split(' ').includes(token))) score += 10
    else if (keywords.some((keyword) => keyword.includes(token))) score += 5
  }

  // Intent is supporting context. It improves ranking without overpowering the query.
  if (intent && name.includes(intent)) score += 20
  if (intent && keywords.some((keyword) => keyword.includes(intent))) score += 16

  for (const token of intentTokens) {
    if (name.split(' ').includes(token)) score += 5
    else if (name.includes(token)) score += 2

    if (keywords.some((keyword) => keyword.split(' ').includes(token))) score += 4
    else if (keywords.some((keyword) => keyword.includes(token))) score += 2
  }

  return searchableValues.some(Boolean) ? score : 0
}

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'search_memes',
    description:
      'Search Memegen.link for real meme templates that match a conversation scenario and the user intent. Use this tool before recommending a meme, then show the returned candidate image previews in the final response.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Keywords describing the conversation scenario or meme concept.',
      },
      intent: {
        type: 'string',
        required: true,
        description:
          'What the user wants to communicate, such as sarcasm, humor, frustration, agreement, or easing awkwardness.',
      },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            imageUrl: { type: 'string' },
            keywords: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.length === 0
          ? 'No matching meme templates were found.'
          : [
            'Matching meme templates:',
            '',
            ...value.flatMap((meme) => [
              `### ${meme.name}`,
              `Template ID: \`${meme.id}\``,
              `![${meme.name}](${meme.imageUrl})`,
              `Keywords: ${meme.keywords.join(', ') || 'none'}`,
              '',
            ]),
            'Show these candidate image previews to the user and use the selected template ID when calling generate_meme.',
          ].join('\n'),
      }],
    },
    async execute(args) {
      // Fetch the live template catalog instead of relying on a local mock list.
      const response = await fetch(MEMEGEN_TEMPLATES_URL, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`Memegen templates request failed with status ${response.status}`)
      }

      const payload: unknown = await response.json()
      if (!Array.isArray(payload)) {
        throw new Error('Memegen templates response must be an array')
      }

      const templates = payload.filter(isMemegenTemplate)
      const query = normalize(args.query)
      const intent = normalize(args.intent)
      const queryTokens = [...new Set(tokenize(args.query))]
      const intentTokens = [...new Set(tokenize(args.intent))]

      // Rank real templates, remove unrelated results, and expose a stable Agent-facing schema.
      // An empty match set remains an empty array so the Agent can decide how to recover.
      return templates
        .map((template) => ({
          template,
          score: scoreTemplate(template, query, intent, queryTokens, intentTokens),
        }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score
          || left.template.name.localeCompare(right.template.name))
        .slice(0, MAX_RESULTS)
        .map(({ template }) => ({
          id: template.id,
          name: template.name,
          imageUrl: template.blank,
          keywords: template.keywords,
        }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'generate_meme',
    description:
      'Generate a meme image from a Memegen template and caption text. Use a template ID returned by search_memes, then provide the text lines in display order.',
    parameters: {
      templateId: {
        type: 'string',
        required: true,
        description: 'The Memegen template ID selected from search_memes results.',
      },
      text: {
        type: 'array',
        required: true,
        description:
          'Caption lines to render in order. Most templates use a top line followed by a bottom line.',
        items: { type: 'string' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          templateId: { type: 'string' },
          text: {
            type: 'array',
            items: { type: 'string' },
          },
          imageUrl: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          'Generated meme:',
          '',
          `Template ID: \`${value.templateId}\``,
          `Caption: ${value.text.join(' / ')}`,
          '',
          `![Generated meme](${value.imageUrl})`,
          '',
          `Image URL: ${value.imageUrl}`,
          '',
          'Show the generated meme image to the user in the final response.',
        ].join('\n'),
      }],
    },
    async execute(args) {
      const templateId = args.templateId.trim()
      const text = args.text.map((line) => line.trim())
      if (!templateId) throw new Error('A non-empty Memegen template ID is required')
      if (text.length === 0 || text.every((line) => !line)) {
        throw new Error('At least one non-empty meme caption line is required')
      }

      const response = await fetch(MEMEGEN_IMAGES_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          text,
          extension: 'png',
          redirect: false,
        }),
      })
      if (!response.ok) {
        throw new Error(`Memegen image request failed with status ${response.status}`)
      }

      const payload: unknown = await response.json()
      if (!isMemegenImage(payload)) {
        throw new Error('Memegen image response must contain a URL')
      }

      return {
        templateId,
        text,
        imageUrl: payload.url,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'search_giphy',
    // NOT responsible for:
    // - deciding user intent
    // - deciding whether GIPHY is the best source
    // - generating memes
    // - choosing the final best meme
    description:
      'Search existing GIPHY reaction GIFs and stickers for emotions, reactions, and conversation scenarios. Use this when an animated reaction is more suitable than generating a captioned meme. Normally call this tool once with the requested result limit. Present the returned previews directly and do not download or inspect the GIF files unless the user explicitly requests visual verification.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'The emotion, reaction, or conversation scenario to search for.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return. Defaults to 5 and cannot exceed 50.',
      },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            gifUrl: { type: 'string' },
            previewUrl: { type: 'string' },
            source: { type: 'string' },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.length === 0
          ? 'GIPHY returned no matching reaction GIFs or stickers.'
          : [
            'Matching GIPHY reactions:',
            '',
            ...value.flatMap((result) => [
              `### ${result.title || 'Untitled GIPHY result'}`,
              `ID: \`${result.id}\``,
              `![${result.title || 'GIPHY preview'}](${result.previewUrl})`,
              `GIF URL: ${result.gifUrl}`,
              '',
            ]),
          ].join('\n'),
      }],
    },
    async execute(args) {
      const apiKey = process.env.GIPHY_API_KEY?.trim()
      if (!apiKey) {
        throw new Error('GIPHY_API_KEY is required to use search_giphy')
      }

      const query = args.query.trim()
      if (!query) throw new Error('A non-empty GIPHY search query is required')

      const requestedLimit = args.limit === undefined ? 5 : Math.trunc(args.limit)
      if (!Number.isFinite(requestedLimit) || requestedLimit < 1) {
        throw new Error('GIPHY search limit must be a positive number')
      }
      const limit = Math.min(requestedLimit, 50)
      const url = new URL(GIPHY_SEARCH_URL)
      url.searchParams.set('api_key', apiKey)
      url.searchParams.set('q', query)
      url.searchParams.set('limit', String(limit))

      const response = await fetch(url, { headers: { accept: 'application/json' } })
      if (!response.ok) {
        throw new Error(`GIPHY search request failed with status ${response.status}`)
      }

      const payload: unknown = await response.json()
      if (typeof payload !== 'object' || payload === null) {
        throw new Error('GIPHY search response must be an object')
      }
      const data = (payload as Record<string, unknown>).data
      if (!Array.isArray(data)) {
        throw new Error('GIPHY search response must contain a data array')
      }

      return data
        .filter(isGiphyItem)
        .map((item) => ({
          id: item.id,
          title: item.title,
          gifUrl: item.images.original.url,
          previewUrl: renditionUrl(item, 'fixed_width_small'),
          source: 'giphy',
        }))
    },
  }))
}
