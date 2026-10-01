console.log('blog.js v3 carregado');

// ── Login (esquema simples, sem senha guardada em lugar nenhum: veio pela URL) ──
const params = new URLSearchParams(window.location.search);
const usuario = params.get('usuario');

if (!usuario) {
    window.location.href = 'index.html';
}

const nomeUsuarioEl = document.getElementById('nome-usuario');
if (nomeUsuarioEl) nomeUsuarioEl.textContent = usuario;

// mesma lista de contas do login.js — usada nas caixinhas de "quem pode ver"
const PERSONAGENS = ['Harvey', 'Maggie', 'Liam', 'Rik', 'Nicollo', 'Leano'];

const formPost = document.getElementById('form-post');
const listaDocumentos = document.getElementById('lista-documentos');
const listaImagensInput = document.getElementById('lista-imagens-input');
const botaoAddImagem = document.getElementById('add-imagem');
const barraPastas = document.getElementById('barra-pastas');
const pastaPostSelect = document.getElementById('pasta-post');
const visTodosCheckbox = document.getElementById('vis-todos');
const listaPersonagensVis = document.getElementById('lista-personagens-vis');
const botaoCancelarEdicao = document.getElementById('cancelar-edicao');
const botaoPublicar = formPost.querySelector('.btn-selo');

let postsCache = [];
let pastasCache = [];
let pastaAtivaId = null;
let editandoId = null;
let contadorImagem = 0;

// ── caixinhas de personagem pra "Classificação de Acesso" ──
PERSONAGENS.forEach((nome) => {
    const label = document.createElement('label');
    label.className = 'opcao-checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'checkbox-personagem';
    input.value = nome;
    label.appendChild(input);
    label.appendChild(document.createTextNode(' ' + nome));
    listaPersonagensVis.appendChild(label);
});

function atualizarEstadoCheckboxesPersonagens() {
    const publico = visTodosCheckbox.checked;
    listaPersonagensVis.style.display = publico ? 'none' : 'flex';
    if (publico) {
        document.querySelectorAll('.checkbox-personagem').forEach((cb) => { cb.checked = false; });
    }
}
visTodosCheckbox.addEventListener('change', atualizarEstadoCheckboxesPersonagens);
atualizarEstadoCheckboxesPersonagens();

function obterVisibilidadeSelecionada() {
    if (visTodosCheckbox.checked) return null; // null = público, todo mundo vê
    const selecionados = Array.from(document.querySelectorAll('.checkbox-personagem:checked')).map((cb) => cb.value);
    if (!selecionados.includes(usuario)) selecionados.push(usuario); // autor sempre enxerga o próprio documento
    return selecionados;
}

function podeVer(post) {
    if (!post.visivel_para || post.visivel_para.length === 0) return true;
    return post.visivel_para.includes(usuario) || post.autor === usuario;
}

// ── linhas dinâmicas de imagem no formulário ──
function ligarBotaoRemover(linha, input, botaoRemover) {
    botaoRemover.addEventListener('click', () => {
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
    input.value = valor;

    const botaoRemover = document.createElement('button');
    botaoRemover.type = 'button';
    botaoRemover.className = 'remover-imagem';
    botaoRemover.setAttribute('aria-label', 'Remover imagem');
    botaoRemover.textContent = '×';

    ligarBotaoRemover(linha, input, botaoRemover);

    linha.appendChild(input);
    linha.appendChild(botaoRemover);
    listaImagensInput.appendChild(linha);
}

listaImagensInput.querySelectorAll('.linha-imagem').forEach((linha) => {
    const input = linha.querySelector('.campo-imagem');
    const botaoRemover = linha.querySelector('.remover-imagem');
    if (input && botaoRemover) ligarBotaoRemover(linha, input, botaoRemover);
});

botaoAddImagem.addEventListener('click', () => criarLinhaImagem());

function resetarLinhasImagem(urls = []) {
    listaImagensInput.innerHTML = '';
    if (urls.length) {
        urls.forEach((url) => criarLinhaImagem(url));
    } else {
        criarLinhaImagem();
    }
}

// ── utilidades de exibição ──
function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

function formatarData(isoString) {
    return new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderizarImagens(post) {
    const urls = (post.imagens && post.imagens.length)
        ? post.imagens
        : (post.imagem_url ? [post.imagem_url] : []); // compatível com posts antigos

    return urls.map((url) => {
        const lado = contadorImagem % 2 === 0 ? 'direita' : 'esquerda';
        contadorImagem += 1;
        return `<img class="documento-imagem documento-imagem-${lado}" src="${escapeHtml(url)}" alt="${escapeHtml(post.titulo)}">`;
    }).join('');
}

// ── Supabase (opcional — se não estiver configurado, o formulário continua usável) ──
const SUPABASE_URL = 'https://rvjzqkbsutrbrpufbyiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2anpxa2JzdXRyYnJwdWZieWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDk5ODAsImV4cCI6MjA5OTcyNTk4MH0.IkRhmcK-I69lmhOOjKhzNqJEBe8LRypQOg3KAeJjpj4';

let supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (erro) {
    console.warn('Supabase ainda não configurado em blog.js (confira SUPABASE_ANON_KEY):', erro);
}

// ── pastas ──
function renderizarPilulasPastas() {
    const pilulasExistentes = pastasCache.map((pasta) => `
        <button type="button" class="pilula-pasta${pastaAtivaId === pasta.id ? ' ativa' : ''}" data-pasta="${pasta.id}">${escapeHtml(pasta.nome)}</button>
    `).join('');

    barraPastas.innerHTML = `
        <button type="button" class="pilula-pasta${!pastaAtivaId ? ' ativa' : ''}" data-pasta="">Todos os documentos</button>
        ${pilulasExistentes}
        <button type="button" class="pilula-pasta pilula-nova" id="nova-pasta">+ nova pasta</button>
    `;
}

function renderizarOpcoesPastaSelect() {
    const selecionado = pastaPostSelect.value;
    pastaPostSelect.innerHTML = '<option value="">Sem pasta</option>' +
        pastasCache.map((pasta) => `<option value="${pasta.id}">${escapeHtml(pasta.nome)}</option>`).join('');
    if (Array.from(pastaPostSelect.options).some((o) => o.value === selecionado)) {
        pastaPostSelect.value = selecionado;
    }
}

async function carregarPastas() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('pastas').select('*').order('nome', { ascending: true });
    if (error) {
        console.error('Erro ao carregar pastas:', error);
        return;
    }
    pastasCache = data || [];
    renderizarPilulasPastas();
    renderizarOpcoesPastaSelect();
}

barraPastas.addEventListener('click', async (evento) => {
    if (evento.target.closest('#nova-pasta')) {
        const nome = prompt('Nome da nova pasta:');
        if (!nome || !nome.trim() || !supabaseClient) return;
        const { error } = await supabaseClient.from('pastas').insert({ nome: nome.trim(), criado_por: usuario });
        if (error) {
            console.error('Erro ao criar pasta:', error);
            alert('Não deu pra criar a pasta — veja o console (F12).');
            return;
        }
        await carregarPastas();
        return;
    }

    const pilula = evento.target.closest('.pilula-pasta');
    if (!pilula) return;
    pastaAtivaId = pilula.dataset.pasta || null;
    renderizarPilulasPastas();
    renderizarPosts();
});

// ── posts ──
function renderizarPosts() {
    const visiveis = postsCache.filter((post) => podeVer(post) && (!pastaAtivaId || post.pasta_id === pastaAtivaId));

    if (!visiveis.length) {
        listaDocumentos.innerHTML = '<p class="carregando">Nenhum documento aqui ainda.</p>';
        return;
    }

    contadorImagem = 0;

    listaDocumentos.innerHTML = visiveis.map((post) => {
        const selo = post.categoria ? `<span class="selo">${escapeHtml(post.categoria)}</span>` : '';
        const restrito = (post.visivel_para && post.visivel_para.length) ? '<span class="marca-privado">Acesso restrito</span>' : '';
        const pasta = pastasCache.find((p) => p.id === post.pasta_id);
        const meuPost = post.autor === usuario;

        const acoes = meuPost ? `
            <div class="documento-acoes">
                <button type="button" class="acao-editar" data-id="${post.id}">editar</button>
                <button type="button" class="acao-excluir" data-id="${post.id}">excluir</button>
            </div>
        ` : '';

        return `
            <article class="documento" data-id="${post.id}">
                <div class="documento-topo">
                    <h2>Documento: ${escapeHtml(post.titulo)}</h2>
                    ${selo}
                </div>
                <p class="documento-meta">Registrado por <strong>${escapeHtml(post.autor)}</strong> · ${formatarData(post.criado_em)}${pasta ? ' · ' + escapeHtml(pasta.nome) : ''} ${restrito}</p>
                <div class="documento-corpo">
                    ${renderizarImagens(post)}
                    <p class="documento-texto">${escapeHtml(post.conteudo)}</p>
                </div>
                ${acoes}
            </article>
        `;
    }).join('');
}

async function carregarPosts() {
    if (!supabaseClient) {
        listaDocumentos.innerHTML = '<p class="carregando">Supabase não configurado neste arquivo ainda.</p>';
        return;
    }

    const { data, error } = await supabaseClient.from('posts').select('*').order('criado_em', { ascending: false });

    if (error) {
        listaDocumentos.innerHTML = '<p class="carregando">Erro ao carregar os registros — veja o console (F12).</p>';
        console.error('Erro ao carregar posts:', error);
        return;
    }

    postsCache = data || [];
    renderizarPosts();
}

// ── editar / excluir ──
function iniciarEdicao(id) {
    const post = postsCache.find((p) => p.id === id);
    if (!post) return;

    editandoId = id;
    document.getElementById('titulo-post').value = post.titulo || '';
    document.getElementById('categoria-post').value = post.categoria || '';
    document.getElementById('conteudo-post').value = post.conteudo || '';
    pastaPostSelect.value = post.pasta_id || '';

    const urls = (post.imagens && post.imagens.length) ? post.imagens : (post.imagem_url ? [post.imagem_url] : []);
    resetarLinhasImagem(urls);

    const restrito = Boolean(post.visivel_para && post.visivel_para.length);
    visTodosCheckbox.checked = !restrito;
    atualizarEstadoCheckboxesPersonagens();
    document.querySelectorAll('.checkbox-personagem').forEach((input) => {
        input.checked = restrito ? post.visivel_para.includes(input.value) : false;
    });

    botaoPublicar.textContent = 'Salvar alterações';
    botaoCancelarEdicao.hidden = false;
    formPost.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelarEdicao() {
    editandoId = null;
    formPost.reset();
    resetarLinhasImagem();
    pastaPostSelect.value = '';
    visTodosCheckbox.checked = true;
    atualizarEstadoCheckboxesPersonagens();
    botaoPublicar.textContent = 'Publicar';
    botaoCancelarEdicao.hidden = true;
}
botaoCancelarEdicao.addEventListener('click', cancelarEdicao);

async function excluirPost(id) {
    if (!supabaseClient) return;
    if (!confirm('Apagar este documento? Essa ação não pode ser desfeita.')) return;

    const { error } = await supabaseClient.from('posts').delete().eq('id', id);
    if (error) {
        console.error('Erro ao apagar:', error);
        alert('Não deu pra apagar — veja o console (F12).');
        return;
    }
    if (editandoId === id) cancelarEdicao();
    await carregarPosts();
}

listaDocumentos.addEventListener('click', (evento) => {
    const btnEditar = evento.target.closest('.acao-editar');
    if (btnEditar) { iniciarEdicao(btnEditar.dataset.id); return; }

    const btnExcluir = evento.target.closest('.acao-excluir');
    if (btnExcluir) { excluirPost(btnExcluir.dataset.id); }
});

// ── publicar / salvar ──
formPost.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    if (!supabaseClient) {
        alert('Supabase não está configurado em blog.js ainda (SUPABASE_ANON_KEY) — não dá pra publicar.');
        return;
    }

    const titulo = document.getElementById('titulo-post').value.trim();
    const categoria = document.getElementById('categoria-post').value.trim();
    const conteudo = document.getElementById('conteudo-post').value.trim();
    const imagens = Array.from(document.querySelectorAll('.campo-imagem')).map((i) => i.value.trim()).filter(Boolean);
    const pastaId = pastaPostSelect.value || null;
    const visivelPara = obterVisibilidadeSelecionada();

    if (!titulo || !conteudo) return;

    botaoPublicar.disabled = true;

    const dados = {
        titulo,
        categoria: categoria || null,
        conteudo,
        imagens: imagens.length ? imagens : null,
        pasta_id: pastaId,
        visivel_para: visivelPara,
    };

    const resultado = editandoId
        ? await supabaseClient.from('posts').update(dados).eq('id', editandoId)
        : await supabaseClient.from('posts').insert({ ...dados, autor: usuario });

    botaoPublicar.disabled = false;

    if (resultado.error) {
        console.error('Erro ao salvar:', resultado.error);
        alert('Não deu pra salvar — veja o console (F12) pra mais detalhes.');
        return;
    }

    cancelarEdicao();
    await carregarPosts();
});

carregarPastas();
carregarPosts();