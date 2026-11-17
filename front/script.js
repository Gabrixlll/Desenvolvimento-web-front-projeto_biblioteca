const API_URL = "http://localhost:5228/api/Materiais";

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

let materialEmEdicao = null;

// Descobre o tipo do material.
function descobrirTipo(m) {
    const chaves = Object.keys(m);
    if (chaves.includes("autor") || chaves.includes("paginas")) return "Livro";
    if (chaves.includes("edicao") || chaves.includes("mesPublicacao")) return "Revista";
    return "Material";
}

function lerMaterial(m) {
    return {
        id: m.id,
        titulo: m.titulo,
        ano: m.anoPublicacao,
        autor: m.autor,
        paginas: m.paginas,
        edicao: m.edicao,
        mes: m.mesPublicacao,
        tipo: descobrirTipo(m)
    };
}

function montarPayloadLivro(d) {
    return { id: d.id, titulo: d.titulo, anoPublicacao: d.ano, autor: d.autor, paginas: d.paginas };
}

function montarPayloadRevista(d) {
    return { id: d.id, titulo: d.titulo, anoPublicacao: d.ano, edicao: d.edicao, mesPublicacao: d.mes };
}

function ehLivro(material) {
    return material.tipo === "Livro";
}

function nomeDoMes(valor) {
    return MESES[Number(valor) - 1] ?? valor;
}

function preencherCampos(raiz, valores) {
    Object.entries(valores).forEach(([nome, valor]) => {
        const elemento = raiz.querySelector(`[data-campo="${nome}"]`);
        if (elemento) {
            elemento.textContent = valor ?? "";
        }
    });
}

function alternarCamposPorTipo(raiz, livro) {
    raiz.querySelectorAll("[data-livro]").forEach((el) => el.classList.toggle("d-none", !livro));
    raiz.querySelectorAll("[data-revista]").forEach((el) => el.classList.toggle("d-none", livro));
}

function abrirModal(seletor) {
    bootstrap.Modal.getOrCreateInstance(document.querySelector(seletor)).show();
}

// Mensagens:
function mostrarMensagem(texto, tipo = "sucesso") {
    const toastEl = document.querySelector("#toast-msg");
    document.querySelector("#toast-texto").textContent = texto;

    toastEl.classList.remove("text-bg-success", "text-bg-danger");
    toastEl.classList.add(tipo === "sucesso" ? "text-bg-success" : "text-bg-danger");

    bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 }).show();
}

function mostrarErrosNoForm(idDiv, erros) {
    const div = document.querySelector(idDiv);
    div.textContent = erros.join(" ");
    div.classList.toggle("d-none", erros.length === 0);
}

function mostrarMensagemNaLista(texto) {
    document.querySelector("#lista-cards").replaceChildren();
    const mensagem = document.querySelector("#mensagem-lista");
    mensagem.textContent = texto;
    mensagem.classList.remove("d-none");
}

async function lerMensagemDeErro(response) {
    try {
        const texto = await response.text();
        try {
            const json = JSON.parse(texto);
            return json.mensagem ?? json.message ?? json.title ?? texto;
        } catch {
            return texto || `Erro ${response.status}`;
        }
    } catch {
        return `Erro ${response.status}`;
    }
}

// VALIDAÇÃO
function validarBase(titulo, ano) {
    const erros = [];
    const anoAtual = new Date().getFullYear();

    if (titulo.trim().length < 2) {
        erros.push("Informe um título com pelo menos 2 caracteres.");
    }
    if (!Number.isInteger(ano) || ano < 1000 || ano > anoAtual) {
        erros.push(`O ano de publicação deve estar entre 1000 e ${anoAtual}.`);
    }
    return erros;
}

function validarLivro(d) {
    const erros = validarBase(d.titulo, d.ano);
    if (d.autor.trim().length < 2) {
        erros.push("Informe o nome do autor.");
    }
    if (!Number.isInteger(d.paginas) || d.paginas <= 0) {
        erros.push("O número de páginas deve ser maior que zero.");
    }
    return erros;
}

function validarRevista(d) {
    const erros = validarBase(d.titulo, d.ano);
    if (!Number.isInteger(d.edicao) || d.edicao <= 0) {
        erros.push("O número da edição deve ser maior que zero.");
    }
    if (!Number.isInteger(d.mes) || d.mes < 1 || d.mes > 12) {
        erros.push("Escolha o mês de publicação.");
    }
    return erros;
}

// busca os detalhes em GET /api/Materiais/{id}.
async function completarMaterial(item) {
    const jaCompleto = ["autor", "paginas", "edicao", "mesPublicacao"].some((c) => c in item);
    if (jaCompleto) return item;

    const response = await fetch(`${API_URL}/${item.id}`);
    if (!response.ok) {
        throw new Error(`Não foi possível buscar os detalhes do material ${item.id}.`);
    }
    return response.json();
}

async function carregarMateriais() {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(await lerMensagemDeErro(response));
        }

        const dados = await response.json();
        const completos = await Promise.all(dados.map(completarMaterial));
        const materiais = completos.map(lerMaterial);

        atualizarDashboard(materiais);
        renderizarLista(materiais);
    } catch (error) {
        console.error("Não foi possível carregar os materiais:", error);
        atualizarDashboard([]);
        mostrarMensagemNaLista("Não foi possível carregar os materiais. Verifique se a API está rodando.");
        mostrarMensagem("Erro ao conectar com a API. Verifique se o backend está rodando.", "erro");
    }
}

function atualizarDashboard(materiais) {
    const livros = materiais.filter(ehLivro).length;
    document.querySelector("#total-materiais").textContent = materiais.length;
    document.querySelector("#total-livros").textContent = livros;
    document.querySelector("#total-revistas").textContent = materiais.length - livros;
}

function renderizarLista(materiais) {
    const areaCards = document.querySelector("#lista-cards");
    const modelo = document.querySelector("#modelo-card");

    areaCards.replaceChildren();

    if (materiais.length === 0) {
        mostrarMensagemNaLista("Nenhum material cadastrado ainda. Use o formulário acima para cadastrar o primeiro.");
        return;
    }

    document.querySelector("#mensagem-lista").classList.add("d-none");

    materiais.forEach((m) => {
        const card = modelo.content.cloneNode(true);
        const livro = ehLivro(m);

        preencherCampos(card, {
            cabecalho: m.tipo,
            titulo: m.titulo,
            id: m.id,
            ano: m.ano,
            tipo: m.tipo,
            autor: m.autor,
            paginas: m.paginas,
            edicao: m.edicao,
            mes: nomeDoMes(m.mes)
        });
        alternarCamposPorTipo(card, livro);

        card.querySelector('[data-acao="consultar"]').addEventListener("click", () => consultarPorId(m.id));
        card.querySelector('[data-acao="descricao"]').addEventListener("click", () => verDescricao(m.id));
        card.querySelector('[data-acao="emprestar"]').addEventListener("click", () => emprestarMaterial(m.id));
        card.querySelector('[data-acao="editar"]').addEventListener("click", () => abrirEdicao(m));
        card.querySelector('[data-acao="excluir"]').addEventListener("click", () => excluirMaterial(m.id, m.titulo));

        areaCards.appendChild(card);
    });
}

//  Barra de pesquisa que busca pelo ID
async function consultarPorId(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`);

        if (response.status === 404) {
            mostrarMensagem(`Material com ID ${id} não encontrado.`, "erro");
            return;
        }
        if (!response.ok) {
            throw new Error(await lerMensagemDeErro(response));
        }

        const m = lerMaterial(await response.json());
        const modal = document.querySelector("#modal-detalhes");

        preencherCampos(modal, {
            id: m.id,
            titulo: m.titulo,
            ano: m.ano,
            tipo: m.tipo,
            autor: m.autor,
            paginas: m.paginas,
            edicao: m.edicao,
            mes: nomeDoMes(m.mes)
        });
        alternarCamposPorTipo(modal, ehLivro(m));
        abrirModal("#modal-detalhes");
    } catch (error) {
        console.error(error);
        mostrarMensagem(`Erro ao consultar o material: ${error.message}`, "erro");
    }
}

function buscarPeloCampo(event) {
    event.preventDefault();
    const id = Number(document.querySelector("#busca-id").value);

    if (!Number.isInteger(id) || id <= 0) {
        mostrarMensagem("Digite um ID válido (número maior que zero).", "erro");
        return;
    }
    consultarPorId(id);
}

// Cadastro de novos materiais.
async function enviarCadastro(url, payload, idErros, form, nomeMaterial) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(await lerMensagemDeErro(response));
        }

        form.reset();
        mostrarErrosNoForm(idErros, []);
        mostrarMensagem(`${nomeMaterial} cadastrado com sucesso!`);
        carregarMateriais();
    } catch (error) {
        console.error(error);
        mostrarMensagem(`Erro ao cadastrar: ${error.message}`, "erro");
    }
}

function cadastrarLivro(event) {
    event.preventDefault();

    const dados = {
        titulo: document.querySelector("#livro-titulo").value,
        ano: parseInt(document.querySelector("#livro-ano").value, 10),
        autor: document.querySelector("#livro-autor").value,
        paginas: parseInt(document.querySelector("#livro-paginas").value, 10)
    };

    const erros = validarLivro(dados);
    mostrarErrosNoForm("#erros-livro", erros);
    if (erros.length > 0) return;

    enviarCadastro(`${API_URL}/livro`, montarPayloadLivro(dados), "#erros-livro", event.target, "Livro");
}

function cadastrarRevista(event) {
    event.preventDefault();

    const dados = {
        titulo: document.querySelector("#revista-titulo").value,
        ano: parseInt(document.querySelector("#revista-ano").value, 10),
        edicao: parseInt(document.querySelector("#revista-edicao").value, 10),
        mes: parseInt(document.querySelector("#revista-mes").value, 10)
    };

    const erros = validarRevista(dados);
    mostrarErrosNoForm("#erros-revista", erros);
    if (erros.length > 0) return;

    enviarCadastro(`${API_URL}/revista`, montarPayloadRevista(dados), "#erros-revista", event.target, "Revista");
}

// Editar os materiais existentes:
function abrirEdicao(material) {
    materialEmEdicao = material;
    const livro = ehLivro(material);

    document.querySelector("#edit-titulo").value = material.titulo;
    document.querySelector("#edit-ano").value = material.ano;

    document.querySelector("#edit-campos-livro").classList.toggle("d-none", !livro);
    document.querySelector("#edit-campos-revista").classList.toggle("d-none", livro);

    if (livro) {
        document.querySelector("#edit-autor").value = material.autor ?? "";
        document.querySelector("#edit-paginas").value = material.paginas ?? "";
    } else {
        document.querySelector("#edit-edicao").value = material.edicao ?? "";
        document.querySelector("#edit-mes").value = Number(material.mes) || 1;
    }

    mostrarErrosNoForm("#erros-edicao", []);
    abrirModal("#modal-edicao");
}

async function salvarEdicao(event) {
    event.preventDefault();
    if (!materialEmEdicao) return;

    const livro = ehLivro(materialEmEdicao);
    const dados = {
        id: materialEmEdicao.id,
        titulo: document.querySelector("#edit-titulo").value,
        ano: parseInt(document.querySelector("#edit-ano").value, 10)
    };

    let erros;
    let payload;
    let rota;

    if (livro) {
        dados.autor = document.querySelector("#edit-autor").value;
        dados.paginas = parseInt(document.querySelector("#edit-paginas").value, 10);
        erros = validarLivro(dados);
        payload = montarPayloadLivro(dados);
        rota = "livro";
    } else {
        dados.edicao = parseInt(document.querySelector("#edit-edicao").value, 10);
        dados.mes = parseInt(document.querySelector("#edit-mes").value, 10);
        erros = validarRevista(dados);
        payload = montarPayloadRevista(dados);
        rota = "revista";
    }

    mostrarErrosNoForm("#erros-edicao", erros);
    if (erros.length > 0) return;

    try {
        const response = await fetch(`${API_URL}/${rota}/${materialEmEdicao.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.status === 404) {
            mostrarMensagem("Esse material não existe mais.", "erro");
        } else if (!response.ok) {
            throw new Error(await lerMensagemDeErro(response));
        } else {
            mostrarMensagem("Material atualizado com sucesso!");
        }

        bootstrap.Modal.getInstance(document.querySelector("#modal-edicao")).hide();
        materialEmEdicao = null;
        carregarMateriais();
    } catch (error) {
        console.error(error);
        mostrarMensagem(`Erro ao atualizar: ${error.message}`, "erro");
    }
}

// Excluir materiais:
async function excluirMaterial(id, titulo) {
    if (!confirm(`Deseja realmente excluir "${titulo}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });

        if (response.status === 404) {
            mostrarMensagem("Esse material não foi encontrado (talvez já tenha sido excluído).", "erro");
        } else if (!response.ok) {
            throw new Error(await lerMensagemDeErro(response));
        } else {
            mostrarMensagem("Material excluído com sucesso!");
        }

        carregarMateriais();
    } catch (error) {
        console.error(error);
        mostrarMensagem(`Erro ao excluir: ${error.message}`, "erro");
    }
}

// Puxa a descrição e o praso dos itens:
async function verDescricao(id) {
    try {
        const response = await fetch(`${API_URL}/${id}/descricao`);

        if (response.status === 404) {
            mostrarMensagem(`Material com ID ${id} não encontrado.`, "erro");
            return;
        }
        if (!response.ok) {
            throw new Error(await lerMensagemDeErro(response));
        }

        const d = await response.json();

        preencherCampos(document.querySelector("#modal-descricao"), {
            tipo: d.tipo,
            descricao: d.descricao,
            prazo: `${d.prazoEmprestimo} dias`
        });
        abrirModal("#modal-descricao");
    } catch (error) {
        console.error(error);
        mostrarMensagem(`Erro ao buscar a descrição: ${error.message}`, "erro");
    }
}

// Exibe se o item pode ser emprestado (revista vai dar erro pois foi criado assim na aula do emerson):
async function emprestarMaterial(id) {
    try {
        const response = await fetch(`${API_URL}/${id}/emprestar`, { method: "POST" });

        if (response.status === 404) {
            mostrarMensagem(`Material com ID ${id} não encontrado.`, "erro");
            return;
        }

        const texto = await lerMensagemDeErro(response);
        if (response.ok) {
            mostrarMensagem(texto);
        } else {
            mostrarMensagem(texto, "erro");
        }
    } catch (error) {
        console.error(error);
        mostrarMensagem(`Erro ao tentar emprestar: ${error.message}`, "erro");
    }
}

// Inicio da página:
function iniciar() {
    document.querySelector("#form-livro").addEventListener("submit", cadastrarLivro);
    document.querySelector("#form-revista").addEventListener("submit", cadastrarRevista);
    document.querySelector("#form-edicao").addEventListener("submit", salvarEdicao);
    document.querySelector("#form-busca").addEventListener("submit", buscarPeloCampo);
    document.querySelector("#btn-recarregar").addEventListener("click", carregarMateriais);

    carregarMateriais();
}

document.addEventListener("DOMContentLoaded", iniciar);