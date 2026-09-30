---
name: meme-selection
description: "Use when helping a user choose a meme for a conversation scenario."
---

# Meme Selection

## Purpose

Help the agent understand what the user wants to communicate
before searching for or generating a meme.

## Step 1: Infer Intent

Before searching for or generating a meme, first infer what
the user wants to communicate.

Possible intents include:

- sarcasm
- humor
- easing awkwardness
- frustration
- agreement
- disagreement
- rejection
- ending the conversation

If the user's intent is ambiguous and materially affects the
meme choice, ask the user for clarification.



## Step 2: Choose Content Type and Source

After understanding the user's intent, choose the content type and source
that best fit the request.

### Mandatory Content-Type Gate

Before calling any content tool, determine whether the user explicitly chose:

- a reaction GIF
- a custom-captioned or existing meme
- both
- or delegated the choice to you

If none applies, stop before taking any content action. Ask the user to choose
Reaction GIF, Custom-captioned meme, or Both, and wait for the answer in a
later turn.

Do not call `search_giphy`, `search_memes`, or `generate_meme` before the user
answers. This prohibition includes searching merely to prepare examples,
candidates, recommendations, or a more informed clarification question.

If the user explicitly delegates the choice, for example "you choose what
works best", choose the content type yourself and continue without asking.

### Reaction GIF

Prefer `search_giphy` when the user wants:

- a reaction GIF or animated response
- an existing visual reaction to an emotion or conversation
- a quick reaction where custom caption text is unnecessary

Examples:

- "Find me a crying reaction GIF."
- "Give me a shocked reaction."
- "I need something animated for this."

Expected source and tool path:

`GIPHY` → `search_giphy`

### Custom Meme

Use Memegen when the user wants:

- a classic meme template
- custom caption text
- a specific meme template
- a meme generated for the user's conversation or scenario

Examples:

- "Find the This Is Fine template."
- "Make a meme about this bug."
- "Use One Does Not Simply with this caption."

Follow Step 3 to choose the exact Memegen tool path.

### Ambiguous Visual Requests

If the user asks for something visual but does not specify whether they
want a reaction GIF or a custom-captioned meme, treat the content type
as materially ambiguous.

Ask the user to choose:
- Reaction GIF
- Custom-captioned meme
- Both

Apply the Mandatory Content-Type Gate before doing anything else.

## Step 3: Handle Memegen Requests

After choosing Custom Meme in Step 2, determine the exact Memegen tool path
for the user's request.

### Find an Existing Meme

If the user wants to find, browse, or get an existing meme or
meme template:

- Use `search_memes`.
- Return suitable existing meme candidates.
- Do not call `generate_meme` unless the user explicitly asks
  to create or customize a meme.

Example:

> "Find me a crying meme."

Expected tool path:

`search_memes`

### Create a Meme Without a Specified Template

If the user wants to create a meme for a scenario but has not
specified which meme template to use:

- Use `search_memes` to find suitable templates.
- Select a suitable template based on the user's intent and scenario.
- Then use `generate_meme` to create the meme.

Example:

> "My colleague said this is a simple change, but I know it will
> take three days. Make me a meme."

Expected tool path:

`search_memes` → `generate_meme`

### Create a Meme With a Specified Template

If the user explicitly specifies a meme template:

- If the exact valid `templateId` is known, use it directly with
  `generate_meme`.
- Do not infer or invent a `templateId` from the template name.
- If the exact `templateId` is unknown, use `search_memes` to resolve it,
  then call `generate_meme` with the resolved ID.

Example:

> "Use the One Does Not Simply template and caption it:
> One does not simply / finish this change today."

Expected tool path:

Known exact `templateId`: `generate_meme`

Unknown exact `templateId`: `search_memes` → `generate_meme`

## Step 4: Completion and Stop Conditions

Stop when the user's requested result has been produced. Do not continue
calling tools merely to gather more options or verify a successful result.

### Reaction GIF Requests

A reaction GIF request is complete when `search_giphy` returns enough
relevant candidates to satisfy the user's requested count.

- Present the returned candidates using their preview URLs.
- Do not download, inspect, or visually verify the GIF files unless the
  user explicitly asks for verification.
- Do not call `search_giphy` again when the first result set is sufficient.
- Do not call `search_memes` or `generate_meme` after a successful GIPHY
  search unless the user asks to switch content type.

If the search returns no useful candidates, refine the query and try once
more. If the second search is still unsuccessful, explain that no suitable
result was found and ask the user to refine the request.

### Existing Meme or Template Requests

An existing meme or template request is complete when `search_memes`
returns suitable candidates.

- Present the candidates and stop.
- Do not call `generate_meme` unless the user asked to create or customize
  a meme.

If no suitable template is found, explain the limitation and ask the user
for another concept or permission to use a different content source.

### Custom Meme Requests

A custom meme request is complete when `generate_meme` successfully returns
the generated meme.

- Present the generated image and stop.
- Do not search for alternative templates or generate additional versions
  unless the user asks for alternatives or revisions.

If generation fails, report the failure clearly. Retry only when the error
is likely temporary or can be corrected with known information; otherwise,
ask the user how they want to proceed.
