console.log('leitura.js v1');

const params = new URLSearchParams(window.location.search);
const usuario = params.get('usuario');
const arquivoId = params.get('arquivo');

if (!usuario) {
    window.location.href = './index.html';
}

const supabaseClient = window.supabaseClient;

const nomeUsuarioEl = document.getElementById('nome-usuario');
const container = document.getElementById('leitura-documento');

if (nomeUsuarioEl) {
    nomeUsuarioEl.textContent = usuario || '—';
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

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

function formatarData(isoString) {
    if (!isoString) return 'data desconhecida';

    return new Date(isoString).toLocaleString('pt-BR', {
        dateStyle: 'long',
        timeStyle: 'short'
    });
}

function podeVer(post) {
    if (!post.visivel_para || post.visivel_para.length === 0) {
        return true;
    }

    return (
        post.visivel_para.includes(usuario) ||
        post.autor === usuario ||
        usuario.toLowerCase() === 'adm'
    );
}

function podeAlterar(post) {
    return (
        post.autor === usuario ||
        usuario.toLowerCase() === 'adm'
    );
}

function obterUrlsImagens(post) {
    if (post.imagens && post.imagens.length) {
        return post.imagens;
    }

    if (post.imagem_url) {
        return [post.imagem_url];
    }

    return [];
}

function configurarLinksBase() {
    const home = urlComUsuario('./home.html');
    const diario = urlComUsuario('./blog.html');

    document.getElementById('voltar-home').href = home;
    document.getElementById('breadcrumb-home').href = home;
    document.getElementById('breadcrumb-diario').href = diario;
}

function renderizarImagens(post) {
    const imagens = obterUrlsImagens(post);

    if (!imagens.length) return '';

    return `
        <section class="leitura-imagens" aria-label="Imagens anexadas">
            <h2>Anexos visuais</h2>

            <div class="leitura-galeria">
                ${imagens.map((url, indice) => `
                    <a
                        class="leitura-imagem-link"
                        href="${escapeHtml(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir imagem em tamanho original"
                    >
                        <img
                            src="${escapeHtml(url)}"
                            alt="Imagem ${indice + 1} do documento ${escapeHtml(post.titulo)}"
                            loading="lazy"
                        >
                    </a>
                `).join('')}
            </div>
        </section>
    `;
}

async function carregarArquivo() {
    configurarLinksBase();

    if (!arquivoId) {
        container.innerHTML = `
            <p class="estado-vazio">
                Nenhum arquivo foi informado.
            </p>
        `;
        return;
    }

    if (!supabaseClient) {
        container.innerHTML = `
            <p class="estado-vazio">
                Supabase não foi iniciado.
            </p>
        `;
        return;
    }

    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', arquivoId)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar documento:', error);

        container.innerHTML = `
            <p class="estado-vazio">
                Não foi possível carregar o arquivo.
            </p>
        `;
        return;
    }

    if (!post) {
        container.innerHTML = `
            <p class="estado-vazio">
                Este arquivo não existe mais.
            </p>
        `;
        return;
    }

    if (!podeVer(post)) {
        container.innerHTML = `
            <p class="estado-vazio">
                Este registro não está disponível para este tripulante.
            </p>
        `;
        return;
    }

    let pasta = null;

    if (post.pasta_id) {
        const resultadoPasta = await supabaseClient
            .from('pastas')
            .select('id, nome')
            .eq('id', post.pasta_id)
            .maybeSingle();

        if (!resultadoPasta.error) {
            pasta = resultadoPasta.data;
        }
    }

    if (pasta) {
        const breadcrumbPasta =
            document.getElementById('breadcrumb-pasta');

        const separadorPasta =
            document.getElementById('separador-pasta');

        breadcrumbPasta.hidden = false;
        separadorPasta.hidden = false;

        breadcrumbPasta.textContent = pasta.nome;
        breadcrumbPasta.href = urlComUsuario(
            './pasta.html',
            { pasta: pasta.id }
        );
    }

    const restrito =
        Boolean(post.visivel_para && post.visivel_para.length);

    const editar = podeAlterar(post)
        ? `
            <a
                class="btn-interface"
                href="${urlComUsuario('./registro.html', { editar: post.id })}"
            >
                Editar arquivo
            </a>
        `
        : '';

    const voltar = pasta
        ? urlComUsuario('./pasta.html', { pasta: pasta.id })
        : urlComUsuario('./blog.html');

    container.innerHTML = `
        <header class="leitura-topo">
            <div>
                <p class="leitura-codigo">
                    ARQUIVO // ${escapeHtml(post.id.slice(0, 8).toUpperCase())}
                </p>

                <h1>${escapeHtml(post.titulo)}</h1>

                <p class="leitura-meta">
                    Registrado por
                    <strong>${escapeHtml(post.autor)}</strong>
                    · ${formatarData(post.criado_em)}
                    ${pasta ? ` · ${escapeHtml(pasta.nome)}` : ' · arquivo avulso'}
                    ${restrito ? ' · <span class="marca-privado">acesso restrito</span>' : ''}
                </p>
            </div>

            <div class="leitura-acoes">
                ${editar}

                <a
                    class="btn-interface"
                    href="${voltar}"
                >
                    ← Voltar aos arquivos
                </a>
            </div>
        </header>

        ${post.categoria
            ? `<div class="leitura-categoria">${escapeHtml(post.categoria)}</div>`
            : ''
        }

        <section class="leitura-corpo">
            <div class="leitura-texto">${escapeHtml(post.conteudo)}</div>
        </section>

        ${renderizarImagens(post)}
    `;

    document.title =
        `${post.titulo} — Diário de Bordo`;
}

carregarArquivo();
