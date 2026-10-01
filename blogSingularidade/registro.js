console.log('registro.js v1');

const params = new URLSearchParams(window.location.search);
const usuario = params.get('usuario');

if (!usuario) {
    window.location.href = './index.html';
}

const supabaseClient = window.supabaseClient;
const BUCKET_IMAGENS = window.SUPABASE_BUCKET_IMAGENS || 'blog-imagens';

const PERSONAGENS = [
    'Harvey',
    'Maggie',
    'Liam',
    'Rik',
    'Nicollo',
    'Leano'
];

const editandoId = params.get('editar');
const pastaInicial = params.get('pasta');

const form = document.getElementById('form-post');
const nomeUsuarioEl = document.getElementById('nome-usuario');
const listaPersonagensVis = document.getElementById('lista-personagens-vis');
const visTodosCheckbox = document.getElementById('vis-todos');
const pastaPostSelect = document.getElementById('pasta-post');
const listaImagensInput = document.getElementById('lista-imagens-input');
const botaoAddImagem = document.getElementById('add-imagem');
const inputArquivos = document.getElementById('arquivos-imagem');
const arquivosSelecionadosEl = document.getElementById('arquivos-selecionados');
const uploadProgresso = document.getElementById('upload-progresso');
const botaoPublicar = document.getElementById('publicar');
const botaoCancelar = document.getElementById('cancelar');
const editorStatus = document.getElementById('editor-status');
const tituloEditor = document.getElementById('titulo-editor');
const breadcrumbEditor = document.getElementById('breadcrumb-editor');

let pastasCache = [];
let arquivosLocais = [];
let postOriginal = null;
let urlsOriginais = [];

if (nomeUsuarioEl) nomeUsuarioEl.textContent = usuario;

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
    const voltarHome = document.getElementById('voltar-home');
    const breadcrumbHome = document.getElementById('breadcrumb-home');
    const breadcrumbDiario = document.getElementById('breadcrumb-diario');

    if (voltarHome) voltarHome.href = urlComUsuario('./home.html');
    if (breadcrumbHome) breadcrumbHome.href = urlComUsuario('./home.html');
    if (breadcrumbDiario) breadcrumbDiario.href = urlComUsuario('./blog.html');
}

function definirStatus(texto = '', tipo = '') {
    editorStatus.textContent = texto;
    editorStatus.className = `editor-status${tipo ? ` ${tipo}` : ''}`;
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

function obterUrlsDoPost(post) {
    if (post.imagens && post.imagens.length) return post.imagens;
    if (post.imagem_url) return [post.imagem_url];
    return [];
}

function criarCheckboxesPersonagens() {
    listaPersonagensVis.innerHTML = '';

    PERSONAGENS.forEach((nome) => {
        const label = document.createElement('label');
        label.className = 'opcao-checkbox';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'checkbox-personagem';
        input.value = nome;

        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${nome}`));
        listaPersonagensVis.appendChild(label);
    });
}

function atualizarEstadoVisibilidade() {
    const publico = visTodosCheckbox.checked;

    listaPersonagensVis.style.display =
        publico ? 'none' : 'flex';

    if (publico) {
        document
            .querySelectorAll('.checkbox-personagem')
            .forEach((checkbox) => {
                checkbox.checked = false;
            });
    }
}

function obterVisibilidadeSelecionada() {
    if (visTodosCheckbox.checked) return null;

    const selecionados = Array.from(
        document.querySelectorAll('.checkbox-personagem:checked')
    ).map((checkbox) => checkbox.value);

    if (!selecionados.includes(usuario)) {
        selecionados.push(usuario);
    }

    return selecionados;
}

function ligarBotaoRemoverUrl(linha, input, botao) {
    botao.addEventListener('click', () => {
        if (listaImagensInput.children.length > 1) {
            linha.remove();
        } else {
            input.value = '';
        }
    });
}

function criarLinhaImagem(valor = '') {
    const linha = document.createElement('div');
    linha.className = 'linha-imagem';

    const input = document.createElement('input');
    input.type = 'url';
    input.className = 'campo-imagem';
    input.placeholder = 'https://...';
    input.inputMode = 'url';
    input.value = valor;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'remover-imagem';
    botao.setAttribute('aria-label', 'Remover URL da imagem');
    botao.textContent = '×';

    ligarBotaoRemoverUrl(linha, input, botao);

    linha.appendChild(input);
    linha.appendChild(botao);
    listaImagensInput.appendChild(linha);
}

function resetarLinhasImagem(urls = []) {
    listaImagensInput.innerHTML = '';

    if (urls.length) {
        urls.forEach(criarLinhaImagem);
    } else {
        criarLinhaImagem();
    }
}

function bytesLegiveis(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderizarArquivosLocais() {
    arquivosSelecionadosEl.innerHTML = '';

    arquivosLocais.forEach((item, indice) => {
        const linha = document.createElement('div');
        linha.className = 'arquivo-local';

        const preview = document.createElement('img');
        preview.className = 'arquivo-local-preview';
        preview.alt = '';
        preview.src = item.preview;

        const info = document.createElement('div');
        info.className = 'arquivo-local-info';
        info.innerHTML = `
            <span class="arquivo-local-nome">${escapeHtml(item.file.name)}</span>
            <span class="arquivo-local-tamanho">${bytesLegiveis(item.file.size)}</span>
        `;

        const remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'arquivo-local-remover';
        remover.textContent = '×';
        remover.setAttribute(
            'aria-label',
            `Remover ${item.file.name}`
        );

        remover.addEventListener('click', () => {
            URL.revokeObjectURL(item.preview);
            arquivosLocais.splice(indice, 1);
            renderizarArquivosLocais();
        });

        linha.appendChild(preview);
        linha.appendChild(info);
        linha.appendChild(remover);

        arquivosSelecionadosEl.appendChild(linha);
    });
}

function adicionarArquivos(files) {
    const MAX_BYTES = 8 * 1024 * 1024;
    const TIPOS = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ]);

    Array.from(files).forEach((file) => {
        if (!TIPOS.has(file.type)) {
            alert(`${file.name}: formato de imagem não aceito.`);
            return;
        }

        if (file.size > MAX_BYTES) {
            alert(`${file.name}: a imagem ultrapassa 8 MB.`);
            return;
        }

        arquivosLocais.push({
            file,
            preview: URL.createObjectURL(file)
        });
    });

    renderizarArquivosLocais();
}

function nomeSeguro(nome) {
    const partes = nome.split('.');
    const extensao = partes.length > 1
        ? `.${partes.pop().toLowerCase()}`
        : '';

    const base = partes.join('.')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70) || 'imagem';

    return `${base}${extensao}`;
}

function caminhoStorageDaUrl(url) {
    const marcador = `/storage/v1/object/public/${BUCKET_IMAGENS}/`;
    const indice = url.indexOf(marcador);

    if (indice === -1) return null;

    return decodeURIComponent(
        url.slice(indice + marcador.length).split('?')[0]
    );
}

async function removerUrlsStorage(urls) {
    const caminhos = urls
        .map(caminhoStorageDaUrl)
        .filter(Boolean);

    if (!caminhos.length) return;

    const { error } = await supabaseClient
        .storage
        .from(BUCKET_IMAGENS)
        .remove(caminhos);

    if (error) {
        console.warn(
            'Não foi possível limpar imagens removidas do Storage:',
            error
        );
    }
}

async function enviarArquivosLocais() {
    if (!arquivosLocais.length) return [];

    uploadProgresso.classList.add('visivel');

    const urls = [];

    try {
        for (let indice = 0; indice < arquivosLocais.length; indice += 1) {
            const { file } = arquivosLocais[indice];

            uploadProgresso.textContent =
                `Enviando imagem ${indice + 1} de ${arquivosLocais.length}...`;

            const pastaUsuario = usuario
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9_-]/g, '-')
                .toLowerCase();

            const aleatorio = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

            const caminho =
                `${pastaUsuario}/${Date.now()}-${aleatorio}-${nomeSeguro(file.name)}`;

            const { error } = await supabaseClient
                .storage
                .from(BUCKET_IMAGENS)
                .upload(caminho, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type
                });

            if (error) throw error;

            const { data } = supabaseClient
                .storage
                .from(BUCKET_IMAGENS)
                .getPublicUrl(caminho);

            urls.push(data.publicUrl);
        }

        return urls;
    } finally {
        uploadProgresso.classList.remove('visivel');
        uploadProgresso.textContent = 'Enviando imagens...';
    }
}

async function carregarPastas() {
    const { data, error } = await supabaseClient
        .from('pastas')
        .select('*')
        .order('nome', { ascending: true });

    if (error) throw error;

    pastasCache = data || [];

    pastaPostSelect.innerHTML =
        '<option value="">Sem pasta</option>' +
        pastasCache
            .map(
                (pasta) =>
                    `<option value="${pasta.id}">${escapeHtml(pasta.nome)}</option>`
            )
            .join('');

    if (pastaInicial && !editandoId) {
        pastaPostSelect.value = pastaInicial;
    }
}

async function carregarPostParaEdicao() {
    if (!editandoId) return;

    const { data, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', editandoId)
        .single();

    if (error) throw error;

    if (
        data.autor !== usuario &&
        usuario.toLowerCase() !== 'adm'
    ) {
        alert('Você não pode editar este documento.');
        window.location.href = urlComUsuario('./blog.html');
        return;
    }

    postOriginal = data;
    urlsOriginais = obterUrlsDoPost(data);

    document.getElementById('titulo-post').value =
        data.titulo || '';

    document.getElementById('categoria-post').value =
        data.categoria || '';

    document.getElementById('conteudo-post').value =
        data.conteudo || '';

    pastaPostSelect.value = data.pasta_id || '';

    resetarLinhasImagem(urlsOriginais);

    const restrito =
        Boolean(data.visivel_para && data.visivel_para.length);

    visTodosCheckbox.checked = !restrito;
    atualizarEstadoVisibilidade();

    document
        .querySelectorAll('.checkbox-personagem')
        .forEach((checkbox) => {
            checkbox.checked =
                restrito &&
                data.visivel_para.includes(checkbox.value);
        });

    tituloEditor.textContent = 'Editar Documento';
    breadcrumbEditor.textContent = 'EDITAR ARQUIVO';
    botaoPublicar.textContent = 'Salvar alterações';
}

function destinoDepoisDeSalvar(pastaId) {
    if (pastaId) {
        return urlComUsuario(
            './pasta.html',
            { pasta: pastaId }
        );
    }

    return urlComUsuario('./blog.html');
}

async function salvarDocumento(evento) {
    evento.preventDefault();

    if (!supabaseClient) {
        definirStatus('Supabase não iniciado.', 'erro');
        return;
    }

    const titulo =
        document.getElementById('titulo-post').value.trim();

    const categoria =
        document.getElementById('categoria-post').value.trim();

    const conteudo =
        document.getElementById('conteudo-post').value.trim();

    const urlsDigitadas = Array.from(
        document.querySelectorAll('.campo-imagem')
    )
        .map((input) => input.value.trim())
        .filter(Boolean);

    const pastaId = pastaPostSelect.value || null;
    const visivelPara = obterVisibilidadeSelecionada();

    if (!titulo || !conteudo) return;

    botaoPublicar.disabled = true;
    definirStatus('Preparando documento...');

    try {
        let urlsEnviadas = [];

        if (arquivosLocais.length) {
            definirStatus('Enviando imagens para o Supabase...');

            try {
                urlsEnviadas = await enviarArquivosLocais();
            } catch (erroUpload) {
                console.error('Erro no upload:', erroUpload);

                throw new Error(
                    'Não foi possível enviar a imagem. Confirme se o bucket "blog-imagens" existe e se você executou o arquivo storage-setup.sql.'
                );
            }
        }

        const imagens = [
            ...new Set([
                ...urlsDigitadas,
                ...urlsEnviadas
            ])
        ];

        const dados = {
            titulo,
            categoria: categoria || null,
            conteudo,
            imagens: imagens.length ? imagens : null,
            pasta_id: pastaId,
            visivel_para: visivelPara
        };

        const resultado = editandoId
            ? await supabaseClient
                .from('posts')
                .update(dados)
                .eq('id', editandoId)
            : await supabaseClient
                .from('posts')
                .insert({
                    ...dados,
                    autor: usuario
                });

        if (resultado.error) throw resultado.error;

        if (editandoId) {
            const removidas = urlsOriginais.filter(
                (url) => !imagens.includes(url)
            );

            await removerUrlsStorage(removidas);
        }

        definirStatus('Documento salvo.', 'sucesso');

        arquivosLocais.forEach((item) => {
            URL.revokeObjectURL(item.preview);
        });

        window.location.href =
            destinoDepoisDeSalvar(pastaId);
    } catch (erro) {
        console.error('Erro ao salvar documento:', erro);

        definirStatus(
            erro.message ||
            'Não foi possível salvar. Veja o console (F12).',
            'erro'
        );
    } finally {
        botaoPublicar.disabled = false;
    }
}

function cancelar() {
    const pastaId = pastaPostSelect.value || pastaInicial || null;
    window.location.href = destinoDepoisDeSalvar(pastaId);
}

async function iniciar() {
    if (!supabaseClient) {
        definirStatus('Supabase não foi iniciado.', 'erro');
        return;
    }

    criarCheckboxesPersonagens();
    atualizarEstadoVisibilidade();

    const primeiraLinha =
        listaImagensInput.querySelector('.linha-imagem');

    if (primeiraLinha) {
        ligarBotaoRemoverUrl(
            primeiraLinha,
            primeiraLinha.querySelector('.campo-imagem'),
            primeiraLinha.querySelector('.remover-imagem')
        );
    }

    configurarNavegacao();

    try {
        await carregarPastas();
        await carregarPostParaEdicao();
    } catch (erro) {
        console.error('Erro ao iniciar editor:', erro);

        definirStatus(
            'Não foi possível carregar o editor. Veja o console (F12).',
            'erro'
        );
    }
}

visTodosCheckbox.addEventListener(
    'change',
    atualizarEstadoVisibilidade
);

botaoAddImagem.addEventListener(
    'click',
    () => criarLinhaImagem()
);

inputArquivos.addEventListener('change', (evento) => {
    adicionarArquivos(evento.target.files);
    inputArquivos.value = '';
});

botaoCancelar.addEventListener('click', cancelar);
form.addEventListener('submit', salvarDocumento);

window.addEventListener('beforeunload', () => {
    arquivosLocais.forEach((item) => {
        URL.revokeObjectURL(item.preview);
    });
});

iniciar();
