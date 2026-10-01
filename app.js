console.log('app.js v3 carregado');

// ── Interface da ficha (funciona mesmo sem o Supabase configurado) ──
const campos = {
    nome: document.querySelector('[name="nome"]'),
    caracteristicas: document.querySelector('[name="caracteristicas"]'),
    inventario: document.querySelector('[name="inventario"]'),
    caracteristicasEspeciais: document.querySelector('[name="caracteristicasEspeciais"]'),
};
const segmentos = document.querySelectorAll('.segmento');

function nivelAtual() {
    return Array.from(segmentos).filter((seg) => seg.classList.contains('preenchido')).length;
}

function definirNivel(nivel) {
    segmentos.forEach((seg, i) => {
        seg.classList.toggle('preenchido', i < nivel);
    });
}

segmentos.forEach((segmento, indice) => {
    segmento.addEventListener('click', () => {
        const alvo = indice + 1;
        const atual = nivelAtual();
        definirNivel(atual === alvo ? alvo - 1 : alvo);
        agendarSalvamento();
    });
});

Object.entries(campos).forEach(([nomeCampo, campo]) => {
    if (!campo) {
        console.warn(`Campo "${nomeCampo}" não encontrado no HTML — confira o atributo name.`);
        return;
    }
    campo.addEventListener('input', agendarSalvamento);
});

// ── Qual ficha abrir: vem da URL (?ficha=uuid). Sem isso, cria uma nova e já
// atualiza a barra de endereço, pra esse link virar o "endereço" dessa ficha. ──
function obterOuCriarFichaId() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('ficha');
    if (!id) {
        id = crypto.randomUUID();
        params.set('ficha', id);
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
    return id;
}
const FICHA_ID = obterOuCriarFichaId();

document.getElementById('nova-ficha')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Abrir uma ficha nova em branco? O link de agora continua salvo e acessível como está.')) {
        window.location.href = window.location.pathname;
    }
});

// ── Supabase (opcional — se não estiver configurado, a ficha continua usável) ──
const SUPABASE_URL = 'https://rvjzqkbsutrbrpufbyiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2anpxa2JzdXRyYnJwdWZieWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDk5ODAsImV4cCI6MjA5OTcyNTk4MH0.IkRhmcK-I69lmhOOjKhzNqJEBe8LRypQOg3KAeJjpj4'; // não é o ref do projeto — veja Project Settings → API

let supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (erro) {
    console.warn('Supabase ainda não configurado (troque SUPABASE_URL/SUPABASE_ANON_KEY em app.js):', erro);
}

async function carregarFicha() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('ficha')
        .select('*')
        .eq('id', FICHA_ID)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar ficha:', error);
        return;
    }
    if (!data) return; // ainda não existe nenhuma ficha salva

    if (campos.nome) campos.nome.value = data.nome ?? '';
    if (campos.caracteristicas) campos.caracteristicas.value = data.caracteristicas ?? '';
    if (campos.inventario) campos.inventario.value = data.inventario ?? '';
    if (campos.caracteristicasEspeciais) campos.caracteristicasEspeciais.value = data.caracteristicas_especiais ?? '';

    definirNivel((data.sanidade ?? []).filter(Boolean).length);
}

async function salvarFicha() {
    if (!supabaseClient) return;

    const sanidade = Array.from(segmentos).map((segmento) =>
        segmento.classList.contains('preenchido')
    );

    const { error } = await supabaseClient.from('ficha').upsert({
        id: FICHA_ID,
        nome: campos.nome?.value ?? '',
        caracteristicas: campos.caracteristicas?.value ?? '',
        inventario: campos.inventario?.value ?? '',
        caracteristicas_especiais: campos.caracteristicasEspeciais?.value ?? '',
        sanidade,
        atualizado_em: new Date().toISOString(),
    });

    if (error) console.error('Erro ao salvar ficha:', error);
}

// Salva sozinho 800ms depois da última mudança, pra não bater no banco a cada letra digitada
let temporizador;
function agendarSalvamento() {
    clearTimeout(temporizador);
    temporizador = setTimeout(salvarFicha, 800);
}

document.addEventListener('DOMContentLoaded', carregarFicha);