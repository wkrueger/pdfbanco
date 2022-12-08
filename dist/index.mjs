import Pdf from "pdf2json";
import fs from "fs";
import pathMod from "path";
import { isEqual, sortBy, range } from "lodash-es";
console.log("pwd", process.cwd());
class Runner {
    async carregaPdf(buffer) {
        const pdfParser = new Pdf();
        return new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", (data) => {
                resolve(data);
            });
            pdfParser.on("pdfParser._dataError", (err) => {
                reject(err);
            });
            pdfParser.parseBuffer(buffer);
        });
    }
    async executar() {
        const files = fs.readdirSync("./files");
        const data = await Promise.all(files.map(async (fileName) => {
            console.log("file", fileName);
            const buffer = fs.readFileSync(pathMod.join("./files", fileName));
            const pdfInfo = await this.carregaPdf(buffer);
            let saldoEncontrado = false;
            const entries = this.obterLancamentosDoDocumento(new DocumentWrap(pdfInfo), fileName)
                .filter(entry => {
                if (entry.lancamento === "S A L D O") {
                    saldoEncontrado = true;
                    return false;
                }
                if (entry.lancamento === "Saldo Anterior")
                    return false;
                if (entry.dia === "Dia")
                    return false;
                return true;
            })
                .map(entry => {
                let [valorStr, sinal] = entry.valor.split(" ");
                valorStr = valorStr.replace(/\./g, "").replace(/\,/g, ".");
                const valor = sinal === "(+)" ? Number(valorStr) : -Number(valorStr);
                return {
                    ...entry,
                    valor,
                };
            });
            if (!saldoEncontrado) {
                throw Error("Marcador de saldo não encontrado - " + fileName);
            }
            return entries;
        }));
        const sorted = sortBy(data.flat(), row => row.dia);
        const header = ["dia", "lançamento", "detalhe", "valor"].join("\t");
        const tsv = [
            header,
            ...sorted.map(row => {
                return [row.dia, row.lancamento, row.lancDetalhe, row.valor].join("\t");
            }),
        ].join("\n");
        fs.writeFileSync("./result/result.tsv", tsv);
    }
    obterLancamentosDoDocumento(document, nomeArquivo) {
        const lancamentos = document.findText("Lançamentos").next().value;
        const tableRangeAtPage = (checkPage) => ({ path }) => {
            const nodePage = path.at(1);
            if (nodePage !== checkPage)
                return false;
            const index = Number(path.at(-1));
            if (index <= Number(lancamentos.path.at(-1)))
                return false;
            return true;
        };
        const infoAdicional = document.findText("Informações Adicionais").next().value;
        const totalAplicacoes = document.findText("Total Aplicações Financeiras").next().value;
        const marcadorDeFim = infoAdicional || totalAplicacoes;
        const paginasDeSaldo = Number(marcadorDeFim.path.at(1)) + 1;
        const porPagina = range(paginasDeSaldo).map(pagina => {
            const dia = document.findText("Dia", tableRangeAtPage(pagina)).next().value;
            const historico = document.findText("Histórico", tableRangeAtPage(pagina)).next().value;
            // const valor = document.findText("Valor", tableRangeAtPage(pagina)).next().value!
            const ehUltimaPagina = pagina === paginasDeSaldo - 1;
            const nodosTabelaIt = document.findText(null, ({ node, path }) => {
                const page = path[1];
                if (page !== pagina)
                    return false;
                if (node.y < dia.node.y)
                    return false;
                if (ehUltimaPagina) {
                    if (node.y > marcadorDeFim.node.y)
                        return false;
                }
                if (isEqual(path, lancamentos.path))
                    return false;
                if (isEqual(path, marcadorDeFim.path))
                    return false;
                return true;
            });
            const nodosTabela = Array.from(nodosTabelaIt);
            let dias1 = nodosTabela
                .filter(n => n.node.x === dia.node.x && n.node.y !== dia.node.y)
                .map(row => {
                const diaSplit = row.textContent.split("/");
                const ymd = diaSplit[2] + diaSplit[1] + diaSplit[0];
                return {
                    nomeArquivo,
                    dia: ymd,
                    start: row.node.y,
                    page: pagina,
                };
            });
            dias1 = sortBy(dias1, "dia");
            const dias2 = dias1.map((row, index, array) => {
                const next = array[index + 1];
                return {
                    ...row,
                    end: next ? next.start : Infinity,
                    lancamento: "",
                    lancDetalhe: "",
                    valor: "",
                };
            });
            for (const nodo of nodosTabela) {
                if (nodo.node.y === dia.node.y) {
                    continue;
                }
                const pos = dias2.find(row => {
                    return nodo.node.y >= row.start && nodo.node.y < row.end;
                });
                if (!pos) {
                    console.log("nf", nodo);
                    throw Error("Not found");
                }
                if (nodo.node.x === dia.node.x) {
                    continue;
                }
                else if (nodo.node.x === historico.node.x) {
                    if (!pos.lancamento)
                        pos.lancamento = nodo.textContent;
                    else {
                        pos.lancDetalhe += nodo.textContent;
                    }
                } /* if (nodo.node.x === valor.node.x) */
                else {
                    pos.valor += nodo.textContent;
                } /* else {
                  throw Error("no case")
                } */
            }
            return dias2;
        });
        return porPagina.flat();
    }
}
class DocumentWrap {
    document;
    constructor(document) {
        this.document = document;
    }
    *findText(text, constraint) {
        for (let pageIdx = 0; pageIdx < this.document.Pages.length; pageIdx++) {
            const page = this.document.Pages[pageIdx];
            for (let textIdx = 0; textIdx < page.Texts.length; textIdx++) {
                const textNode = page.Texts[textIdx];
                const textContent = textNode.R.map(x => decodeURIComponent(x.T)).join(" ");
                const context = {
                    path: ["Pages", pageIdx, "Texts", textIdx],
                    node: textNode,
                    textContent,
                };
                if (constraint && !constraint(context)) {
                    continue;
                }
                if (text === null || textContent === text) {
                    yield context;
                }
            }
        }
    }
}
new Runner().executar();
//# sourceMappingURL=index.mjs.map