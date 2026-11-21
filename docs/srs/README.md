# LayaProfile SRS (Persian)

`main.tex` is the Persian Business Requirements (BRD) and Software Requirements Specification (SRS)
document of LayaProfile, version 1.0, dated 2026-11-21 (1405/08/30). It is written in Persian with
XeLaTeX and the `xepersian` package, from the course template it was based on, and follows the
section structure of that template.

## Files

| File          | Purpose                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| `main.tex`    | The document source. Compile this file.                                           |
| `XB Yas.ttf`  | The Persian text font that `main.tex` loads. Not committed (license unverified): copy it from the original SRS template into this folder before compiling. |
| `README.md`   | This file.                                                                        |

Everything in the document describes the repository as it is (code, `README.md`, `docs/`, `PLAN.md`
and Git history). Targets that have not been measured yet, such as Laya latency and memory, are
marked "not measured" in the text, and no figure has been invented for them.

## Compiling

The document needs XeLaTeX (it uses `fontspec` through `xepersian`) and the packages `geometry`,
`hyperref`, `xcolor`, `xepersian`, `setspace` and `enumitem`. A full TeX Live installation has all
of them.

### With a local TeX Live

Run XeLaTeX **twice** from this folder, with `XB Yas.ttf` next to `main.tex`. The first pass writes
the table of contents and the second pass reads it:

```sh
cd docs/srs
xelatex main.tex
xelatex main.tex
```

The result is `main.pdf`.

### With Docker

No local TeX installation is needed. The image is large (several gigabytes):

```sh
cd docs/srs
docker run --rm -v "$PWD":/w -w /w texlive/texlive sh -c "xelatex main.tex && xelatex main.tex"
```

On Linux add `-u "$(id -u):$(id -g)"` so the generated files belong to you instead of root.

### Build files

XeLaTeX writes `main.pdf`, `main.aux`, `main.toc`, `main.out` and `main.log` into the folder. They
are build output, not sources: do not commit them.

## Status of this document

- **It has not been compiled yet.** The environment that produced it had no TeX installation and no
  Docker access. It was checked structurally instead: every `\begin` has its `\end`, braces balance
  in every paragraph, every `tabular` row has the number of cells its column specification
  declares, no special character (`%`, `&`, `_`, `#`) is left unescaped in the text, and all
  `FR-*` identifiers that are referenced are defined and appear in the traceability matrix.
- **Expect to look at the first compile log.** Layout warnings such as overfull boxes in the narrow
  table columns are possible. If a table moves to another page and LaTeX complains about too many
  unprocessed floats, add a `\clearpage` before it.
- **No new LaTeX package was added.** The preamble is the template's, plus two helper macros:
  `\code{...}` (monospaced Latin text such as file names and environment variables, kept
  left-to-right) and `\tablefont` (a smaller, tighter font for the compact tables). The diagrams are
  described as plain `tabular` tables and numbered lists, because no drawing package is loaded.
- **The font license has not been checked.** `XB Yas.ttf` comes from the template and is used only
  for this document. Check its license before publishing the PDF or the font file anywhere.

## Editing

- Technical terms stay in English inside `\lr{...}` (or `\code{...}` for monospaced text). Escape
  `_`, `%`, `&` and `#` in text (`\_`, `\%`, `\&`, `\#`).
- Requirement identifiers are `FR-PRF`, `FR-REPO`, `FR-CMP`, `FR-LAYA`, `FR-SKL`, `FR-LRN`,
  `FR-SHR`, `FR-API` and `FR-OPS` (52 functional requirements), and `NFR-PERF`, `NFR-REL`,
  `NFR-SEC`, `NFR-MAINT`, `NFR-A11Y`, `NFR-PORT` and `NFR-PRIV` (47 non-functional requirements).
  When a requirement is added, renamed or removed, update the traceability tables as well.
- When the code and this document disagree, the code and the documents in `docs/` are the
  reference, and the SRS must be corrected. Add a row to the revision history table at the end of
  `main.tex` for every released version.
