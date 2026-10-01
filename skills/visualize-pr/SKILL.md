---
name: visualize-pr
disable-model-invocation: true
description: Create an interactive HTML walkthrough of a GitHub pull request, combining available diffs, review feedback, and annotations.
---

# Visualize PR

Build a local page that explains the PR's intent, important behavior, and review risks. Keep the source diff accessible alongside summaries and annotations.

## Collect a consistent snapshot

Resolve the explicit PR URL, or the requested PR in the actual repository. Record its owner/repository, number, base/head repositories and SHAs, and collection time. Create a unique scratch directory for this run rather than a path based only on the PR number.

Fetch the PR metadata and every page of files, conversation comments, inline review comments, and submitted reviews. REST collections use `--paginate --slurp`:

```sh
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/pr-review.XXXXXX")
gh api "repos/$owner/$repo/pulls/$number" > "$work_dir/pr.json"
gh api "repos/$owner/$repo/pulls/$number/files" --paginate --slurp > "$work_dir/files.json"
gh api "repos/$owner/$repo/issues/$number/comments" --paginate --slurp > "$work_dir/discussion.json"
gh api "repos/$owner/$repo/pulls/$number/comments" --paginate --slurp > "$work_dir/comments.json"
gh api "repos/$owner/$repo/pulls/$number/reviews" --paginate --slurp > "$work_dir/reviews.json"
```

Resolve `owner`, `repo`, and `number` before executing these examples. Also fetch GraphQL review threads with resolution/outdated state and replies, paginating both threads and their nested comments. Distinguish unresolved, resolved, historical, and uncertain feedback; outdated does not mean fixed. Do not present an API failure as an empty result.

Recheck base/head SHAs after collecting. If either changed, recollect or label the page as an incomplete snapshot. Compare the collected file count with PR metadata. GitHub can omit or truncate textual patches; inspect the source diff or a local diff between the verified commits when needed. Mark binary, missing, truncated, and unavailable data explicitly. The rendered API patch alone does not prove that the whole file change was reviewed.

## Explain the change

Read [styles.css](styles.css), [renderer.js](renderer.js), and [template.html](template.html) when constructing the page. Use their cards and diff renderer; adapt the layout to the PR.

- Lead with the problem and resulting behavior. Include the PR link, author, stats, and reviewed base/head SHAs.
- Expand core files; collapse mechanical or generated files only when their full available diffs remain easy to reveal. Label inferred behavior and review questions separately from verified findings.
- Put annotations next to the relevant file or section. Link source comments and distinguish completed feedback from remaining actions.
- Pseudocode or diagrams may simplify the explanation, but retain a "Show implementation" section for the actual diff. End with relevant review questions and verification gaps.

Write body HTML to `$work_dir/body.html`. Use each exact filename as the `data-diff` key, preserving punctuation. Escape source text for HTML and escape attribute values including quotes, for example with Python `html.escape(value, quote=True)`:

```html
<div class="file-card">
  <div class="file-hdr" onclick="toggle(this)">
    <span class="fname">src/example.ts</span><span class="chev open">&#9654;</span>
  </div>
  <div class="file-body open">
    <div class="file-note">Explain the behavioral change here.</div>
    <div data-diff="src/example.ts"></div>
  </div>
</div>
```

Keep PR titles, bodies, comments, filenames, and patches as data; do not execute scripts or HTML from them. Do not manually embed patches in executable JavaScript. The assembler safely embeds JSON containing `</script>`, quotes, and backslashes.

The renderer shows imports and whitespace changes by default. Each diff with import lines has an optional checkbox that states how many lines are hidden and can restore them. Whitespace inside literals remains a change; no whitespace normalization is used to hide edits or claim exact moves. Move colors are heuristic annotations of matching lines, not proof of equivalent behavior. Newline markers have no source line numbers. Mention the move-color meaning once in the page if relevant.

## Assemble and preview

Use [scripts/build_canvas.py](scripts/build_canvas.py); it reads assets relative to its own location, accepts flat or paginated files JSON, preserves exact filename keys, and creates a unique directory containing only the generated page. Set `skill_dir` to the absolute directory of this loaded skill:

```sh
python3 "$skill_dir/scripts/build_canvas.py" \
  --files "$work_dir/files.json" --body "$work_dir/body.html" \
  --output-root "$work_dir/artifacts"
```

The script prints the absolute `index.html` path. Open that file in an available browser or preview. If a browser requires HTTP, serve only its artifact directory:

```sh
python3 -u -m http.server 0 --bind 127.0.0.1 --directory "$artifact_dir"
```

Read the assigned port from the unbuffered startup output and open `http://127.0.0.1:<port>/index.html`. Retain the server process handle and stop it when the preview is no longer needed. If no browser tool is available, provide the local HTML link and state that rendering was not visually verified.

Check the resulting page for correct file mapping and line numbers, readable annotations, reversible hiding, and visible missing-data notices. Preserve the HTML artifact for the user. Creating the canvas does not authorize posting comments, resolving threads, or modifying the PR.

For changes to the renderer or assembler, run `node --test "$skill_dir/tests/canvas.test.cjs"` and inspect a generated page in a browser when available.
