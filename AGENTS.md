<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI provider selection lives in `src/lib/ia.server.ts`: a key stored in `configuracao_ia` starting with `sk-ant-` routes every AI call to the Anthropic Messages API (Claude); otherwise the Lovable AI Gateway is used with `LOVABLE_API_KEY` or the stored key. Keep this detection single-sourced there — no other module should decide the provider.
