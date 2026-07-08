Status: ready-for-agent

# 02 — 扩展全 pandoc 格式 + pdf 显式拒绝

## Parent

ADR-0007(`docs/adr/0007-non-md-bash-pandoc.md`)决策 1(后缀白名单)+ 决策 5(pdf 暂不支持)。

## What to build

Slice 01 只通了 docx。本 slice 把白名单扩展到 pandoc 支持的全格式,并显式拒绝 pdf(回 415 + 提示)。

pandoc `--from=` 原生支持的输入格式(无 experimental 标注):docx / xlsx / pptx / odt / epub / html / rtf / csv / tsv / json / xml / org / rst / latex / asciidoc 等。白名单取这些后缀。pdf 不在(pandoc 不支持 pdf 输入,且 pdftotext 便携分发是软肋,ADR-0007 决策 5 单独留待)。

实现:

- 前端 accept + 后端 `/api/upload` 白名单扩展到 pandoc 全格式后缀
- pdf 不在白名单:`/api/upload` 遇 .pdf 回 415 + `{ error: "pdf 暂不支持" }`;前端 accept 不含 pdf
- 单一白名单常量(前后端共用,避免漂移)——后端 `interaction.ts` 与前端 `ChatPanel.tsx` 引同一份后缀列表

## Acceptance criteria

- [ ] 前端 accept + 后端 `/api/upload` 白名单含 pandoc 全格式(docx/xlsx/pptx/odt/epub/html/rtf/csv/json/xml/org/rst 等)
- [ ] `/api/upload` 遇 .pdf 回 415 + 提示"pdf 暂不支持"
- [ ] 前端 accept 不含 .pdf
- [ ] 白名单后缀列表前后端共用单一常量(无漂移)
- [ ] 各格式上传落 raw/ 成功(选 2-3 个代表格式测:xlsx/pptx/epub)
- [ ] `make typecheck` + `make lint` + `npm test` 通过

## Blocked by

- 01 — docx 上传→编译端到端 tracer bullet(通路先通,再扩展格式)
