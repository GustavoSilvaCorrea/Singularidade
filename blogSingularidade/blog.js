console.log('blog.js v4 — hub do diário');

const params = new URLSearchParams(window.location.search);
const usuario = params.get('usuario');

if (!usuario) {
    window.location.href = './index.html';
}

const supabaseClient = window.supabaseClient;
const pagina = document.body.dataset.pagina || 'diario';
const BUCKET_IMAGENS = window.SUPABASE_BUCKET_IMAGENS || 'blog-imagens';

const nomeUsuarioEl = document.getElementById('nome-usuario');
if (nomeUsuarioEl) nomeUsuarioEl.textContent = usuario || '—';

let pastasCache = [];
let postsCache = [];
let pastaAtual = null;

function urlComUsuario(caminho, extras = {}) {
    const url = new URL(caminho, window.location.href);
    url.searchParams.set('usuario', usuario);

    Object.entries(extras).forEach(([chave, valor]) => {
        if (valor !== null && valor !== undefined && valor !== '') {
            url.searchParams.set(chave, valor);
        }
    });

    return url.pathname.split('/').pop() + url.search;
}

function configurarNavegacao() {
    const home = urlComUsuario('./home.html');
    const diario = urlComUsuario('./blog.html');

    const voltarHome = document.getElementById('voltar-home');
    const breadcrumbHome = document.getElementById('breadcrumb-home');
    const breadcrumbDiario = document.getElementById('breadcrumb-diario');
    const linkNovo = document.getElementById('link-novo-documento');

    if (voltarHome) voltarHome.href = home;
    if (breadcrumbHome) breadcrumbHome.href = home;
    if (breadcrumbDiario) breadcrumbDiario.href = diario;
    if (linkNovo) linkNovo.href = urlComUsuario('./registro.html');
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

function formatarData(isoString) {
    if (!isoString) return 'data desconhecida';

    return new Date(isoString).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function podeVer(post) {
    if (!post.visivel_para || post.visivel_para.length === 0) return true;
    return post.visivel_para.includes(usuario) || post.autor === usuario;
}

function podeAlterarPost(post) {
    return post.autor === usuario || usuario.toLowerCase() === 'adm';
}

function podeExcluirPasta(pasta) {
    return pasta.criado_por === usuario || usuario.toLowerCase() === 'adm';
}

function obterUrlsImagens(post) {
    if (post.imagens && post.imagens.length) return post.imagens;
    if (post.imagem_url) return [post.imagem_url];
    return [];
}

function caminhoStorageDaUrl(url) {
    const marcador = `/storage/v1/object/public/${BUCKET_IMAGENS}/`;
    const indice = url.indexOf(marcador);

    if (indice === -1) return null;

    return decodeURIComponent(
        url.slice(indice + marcador.length).split('?')[0]
    );
}

async function limparImagensStorage(post) {
    if (!supabaseClient) return;

    const caminhos = obterUrlsImagens(post)
        .map(caminhoStorageDaUrl)
        .filter(Boolean);

    if (!caminhos.length) return;

    const { error } = await supabaseClient
        .storage
        .from(BUCKET_IMAGENS)
        .remove(caminhos);

    if (error) {
        // A exclusão do documento não deve falhar por causa de limpeza de mídia.
        console.warn('Não foi possível remover algumas imagens do Storage:', error);
    }
}

function renderizarImagens(post) {
    const urls = obterUrlsImagens(post);

    return urls.map((url, indice) => {
        const lado = indice % 2 === 0 ? 'direita' : 'esquerda';

        return `
            <img
                class="documento-imagem documento-imagem-${lado}"
                src="${escapeHtml(url)}"
                alt="${escapeHtml(post.titulo)}"
                loading="lazy"
            >
        `;
    }).join('');
}

function resumirConteudo(texto, limite = 280) {
    const limpo = (texto || '')
        .replace(/\s+/g, ' ')
        .trim();

    if (limpo.length <= limite) return limpo;

    return `${limpo.slice(0, limite).trimEnd()}…`;
}

function renderizarDocumento(post) {
    const pasta = pastasCache.find((item) => item.id === post.pasta_id);
    const restrito = post.visivel_para && post.visivel_para.length;
    const podeAlterar = podeAlterarPost(post);
    const imagens = obterUrlsImagens(post);
    const urlLeitura = urlComUsuario(
        './leitura.html',
        { arquivo: post.id }
    );

    const acoesAlteracao = podeAlterar
        ? `
            <a
                class="link-editar-documento"
                href="${urlComUsuario('./registro.html', { editar: post.id })}"
            >
                editar
            </a>

            <button
                type="button"
                class="acao-excluir"
                data-post-id="${post.id}"
            >
                excluir
            </button>
        `
        : '';

    const miniatura = imagens.length
        ? `
            <img
                class="documento-imagem documento-imagem-direita"
                src="${escapeHtml(imagens[0])}"
                alt=""
                loading="lazy"
            >
        `
        : '';

    return `
        <article
            class="documento documento-resumo documento-clicavel"
            data-id="${post.id}"
            data-abrir-post="${post.id}"
            tabindex="0"
            role="link"
            aria-label="Abrir documento ${escapeHtml(post.titulo)}"
        >
            <div class="documento-topo">
                <h2>Documento: ${escapeHtml(post.titulo)}</h2>
                ${post.categoria ? `<span class="selo">${escapeHtml(post.categoria)}</span>` : ''}
            </div>

            <p class="documento-meta">
                Registrado por <strong>${escapeHtml(post.autor)}</strong>
                · ${formatarData(post.criado_em)}
                ${pasta ? ` · ${escapeHtml(pasta.nome)}` : ''}
                ${restrito ? ' · <span class="marca-privado">Acesso restrito</span>' : ''}
            </p>

            <div class="documento-corpo">
                ${miniatura}
                <p class="documento-texto documento-texto-resumo">
                    ${escapeHtml(resumirConteudo(post.conteudo))}
                </p>
            </div>

            <div class="documento-acoes">
                <a
                    class="link-editar-documento link-abrir-documento"
                    href="${urlLeitura}"
                >
                    abrir arquivo
                </a>

                ${acoesAlteracao}
            </div>
        </article>
    `;
}

async function carregarDados() {
    if (!supabaseClient) {
        throw new Error('Supabase não foi iniciado.');
    }

    const [pastasResultado, postsResultado] = await Promise.all([
        supabaseClient
            .from('pastas')
            .select('*')
            .order('nome', { ascending: true }),

        supabaseClient
            .from('posts')
            .select('*')
            .order('criado_em', { ascending: false })
    ]);

    if (pastasResultado.error) throw pastasResultado.error;
    if (postsResultado.error) throw postsResultado.error;

    pastasCache = pastasResultado.data || [];
    postsCache = postsResultado.data || [];
}

async function criarPasta() {
    const nome = prompt('Nome da nova pasta:');

    if (!nome || !nome.trim() || !supabaseClient) return;

    const { error } = await supabaseClient
        .from('pastas')
        .insert({
            nome: nome.trim(),
            criado_por: usuario
        });

    if (error) {
        console.error('Erro ao criar pasta:', error);
        alert('Não foi possível criar a pasta. Veja o console (F12).');
        return;
    }

    await atualizarTela();
}

async function excluirPasta(id) {
    const pasta = pastasCache.find((item) => item.id === id);

    if (!pasta || !podeExcluirPasta(pasta)) return;

    const quantidade = postsCache.filter(
        (post) => post.pasta_id === id
    ).length;

    const texto = quantidade
        ? `Excluir a pasta "${pasta.nome}"?\n\nOs ${quantidade} documento(s) dentro dela NÃO serão apagados. Eles passarão a aparecer como arquivos avulsos.`
        : `Excluir a pasta "${pasta.nome}"?`;

    if (!confirm(texto)) return;

    // Primeiro tira os documentos da pasta, para nunca apagar conteúdo do RPG.
    const mover = await supabaseClient
        .from('posts')
        .update({ pasta_id: null })
        .eq('pasta_id', id);

    if (mover.error) {
        console.error('Erro ao retirar documentos da pasta:', mover.error);
        alert('Não foi possível preparar a exclusão da pasta. Veja o console (F12).');
        return;
    }

    const apagar = await supabaseClient
        .from('pastas')
        .delete()
        .eq('id', id);

    if (apagar.error) {
        console.error('Erro ao excluir pasta:', apagar.error);
        alert('Não foi possível excluir a pasta. Veja o console (F12).');
        return;
    }

    if (pagina === 'pasta') {
        window.location.href = urlComUsuario('./blog.html');
        return;
    }

    await atualizarTela();
}

async function excluirPost(id) {
    const post = postsCache.find((item) => item.id === id);

    if (!post || !podeAlterarPost(post)) return;

    if (!confirm('Apagar este documento? Essa ação não pode ser desfeita.')) {
        return;
    }

    const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erro ao excluir documento:', error);
        alert('Não foi possível excluir o documento. Veja o console (F12).');
        return;
    }

    await limparImagensStorage(post);
    await atualizarTela();
}

function renderizarHub() {
    const grade = document.getElementById('grade-pastas');
    const listaAvulsos = document.getElementById('lista-documentos-avulsos');

    const postsVisiveis = postsCache.filter(podeVer);

    if (grade) {
        if (!pastasCache.length) {
            grade.innerHTML = `
                <p class="estado-vazio">
                    Nenhuma pasta criada ainda. Use “+ Nova pasta” para começar.
                </p>
            `;
        } else {
            grade.innerHTML = pastasCache.map((pasta, indice) => {
                const quantidade = postsVisiveis.filter(
                    (post) => post.pasta_id === pasta.id
                ).length;

                const excluir = podeExcluirPasta(pasta)
                    ? `
                        <button
                            type="button"
                            class="pasta-excluir"
                            data-excluir-pasta="${pasta.id}"
                            title="Excluir pasta"
                            aria-label="Excluir pasta ${escapeHtml(pasta.nome)}"
                        >
                            ×
                        </button>
                    `
                    : '';

                return `
                    <article class="pasta-card">
                        <div class="pasta-card-topo">
                            <a
                                class="pasta-link"
                                href="${urlComUsuario('./pasta.html', { pasta: pasta.id })}"
                            >
                                <span class="pasta-codigo">
                                    DIRETÓRIO // ${String(indice + 1).padStart(2, '0')}
                                </span>

                                <h3>${escapeHtml(pasta.nome)}</h3>

                                <p class="pasta-card-meta">
                                    ${quantidade} arquivo(s) visível(is)
                                    · criado por ${escapeHtml(pasta.criado_por || 'desconhecido')}
                                </p>
                            </a>

                            ${excluir}
                        </div>
                    </article>
                `;
            }).join('');
        }
    }

    if (listaAvulsos) {
        const avulsos = postsVisiveis.filter((post) => !post.pasta_id);

        listaAvulsos.innerHTML = avulsos.length
            ? avulsos.map(renderizarDocumento).join('')
            : `
                <p class="estado-vazio">
                    Nenhum arquivo avulso. Documentos sem pasta aparecerão aqui.
                </p>
            `;
    }
}

function renderizarPasta() {
    const pastaId = params.get('pasta');
    const titulo = document.getElementById('titulo-pasta');
    const meta = document.getElementById('meta-pasta');
    const lista = document.getElementById('lista-documentos-pasta');
    const contador = document.getElementById('contador-arquivos');
    const excluir = document.getElementById('excluir-pasta');
    const novoNaPasta = document.getElementById('novo-na-pasta');
    const breadcrumbPasta = document.getElementById('breadcrumb-pasta');

    pastaAtual = pastasCache.find((item) => item.id === pastaId) || null;

    if (!pastaAtual) {
        if (titulo) titulo.textContent = 'Pasta não encontrada';
        if (meta) meta.textContent = 'Este diretório não existe mais.';
        if (lista) {
            lista.innerHTML = `
                <p class="estado-vazio">
                    Volte ao Diário para escolher outra pasta.
                </p>
            `;
        }
        if (contador) contador.textContent = '0 arquivos';
        return;
    }

    if (titulo) titulo.textContent = pastaAtual.nome;
    if (breadcrumbPasta) breadcrumbPasta.textContent = pastaAtual.nome;
    if (meta) {
        meta.textContent =
            `Criada por ${pastaAtual.criado_por || 'desconhecido'}`;
    }

    if (novoNaPasta) {
        novoNaPasta.href = urlComUsuario(
            './registro.html',
            { pasta: pastaAtual.id }
        );
    }

    if (excluir && podeExcluirPasta(pastaAtual)) {
        excluir.hidden = false;
        excluir.dataset.excluirPasta = pastaAtual.id;
    }

    const documentos = postsCache.filter(
        (post) => podeVer(post) && post.pasta_id === pastaAtual.id
    );

    if (contador) {
        contador.textContent =
            `${documentos.length} arquivo(s) visível(is)`;
    }

    if (lista) {
        lista.innerHTML = documentos.length
            ? documentos.map(renderizarDocumento).join('')
            : `
                <p class="estado-vazio">
                    Esta pasta ainda não possui documentos visíveis.
                </p>
            `;
    }
}

async function atualizarTela() {
    try {
        await carregarDados();

        if (pagina === 'pasta') {
            renderizarPasta();
        } else {
            renderizarHub();
        }
    } catch (erro) {
        console.error('Erro ao carregar Diário:', erro);

        const alvos = [
            document.getElementById('grade-pastas'),
            document.getElementById('lista-documentos-avulsos'),
            document.getElementById('lista-documentos-pasta')
        ].filter(Boolean);

        alvos.forEach((alvo) => {
            alvo.innerHTML = `
                <p class="estado-vazio">
                    Não foi possível carregar os dados. Veja o console (F12).
                </p>
            `;
        });
    }
}

document.addEventListener('click', async (evento) => {
    const documentoClicado = evento.target.closest('[data-abrir-post]');
    const controleClicado = evento.target.closest(
        'a, button, input, textarea, select, label'
    );

    if (documentoClicado && !controleClicado) {
        abrirDocumentoCompleto(documentoClicado.dataset.abrirPost);
        return;
    }

    const novaPasta = evento.target.closest('#nova-pasta');

    if (novaPasta) {
        await criarPasta();
        return;
    }

    const excluirPastaBotao = evento.target.closest('[data-excluir-pasta]');

    if (excluirPastaBotao) {
        await excluirPasta(excluirPastaBotao.dataset.excluirPasta);
        return;
    }

    const excluirPostBotao = evento.target.closest('[data-post-id]');

    if (excluirPostBotao) {
        await excluirPost(excluirPostBotao.dataset.postId);
    }
});


function abrirDocumentoCompleto(id) {
    if (!id) return;

    window.location.href = urlComUsuario(
        './leitura.html',
        { arquivo: id }
    );
}

document.addEventListener('keydown', (evento) => {
    const documento = evento.target.closest?.('[data-abrir-post]');

    if (!documento) return;

    if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        abrirDocumentoCompleto(documento.dataset.abrirPost);
    }
});

configurarNavegacao();
atualizarTela();
