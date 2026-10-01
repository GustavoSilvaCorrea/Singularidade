console.log('app.js v4 — ficha vinculada ao tripulante');

// ─────────────────────────────────────────────────────────────
// Mapeamento do LOGIN para o nome EXATO já salvo na tabela ficha.
// Não é senha do banco: o login identifica o personagem e a ficha
// é localizada pelo campo "nome" no Supabase.
// ─────────────────────────────────────────────────────────────
const FICHAS_DOS_TRIPULANTES = {
    harvey: 'Harvey Ashford',
    maggie: 'Maggie W. Massey',
    liam: 'Liam Gagnon',
    rik: 'Rodion "Rik" Rozanov',
    nicollo: 'Nicollo Menestrina',
    leano: 'Leanon Sins'
};

const paramsIniciais = new URLSearchParams(window.location.search);
const usuarioLogado = paramsIniciais.get('usuario') || '';
const chaveUsuario = usuarioLogado.trim().toLowerCase();
const nomeFichaVinculada = FICHAS_DOS_TRIPULANTES[chaveUsuario] || null;

// ── Interface da ficha ───────────────────────────────────────
const campos = {
    nome: document.querySelector('[name="nome"]'),
    caracteristicas: document.querySelector('[name="caracteristicas"]'),
    inventario: document.querySelector('[name="inventario"]'),
    caracteristicasEspeciais: document.querySelector('[name="caracteristicasEspeciais"]'),
};

const segmentos = document.querySelectorAll('.segmento');
const botaoNovaFicha = document.getElementById('nova-ficha');

let FICHA_ID = null;

function nivelAtual() {
    return Array.from(segmentos).filter(
        (seg) => seg.classList.contains('preenchido')
    ).length;
}

function definirNivel(nivel) {
    segmentos.forEach((seg, indice) => {
        seg.classList.toggle('preenchido', indice < nivel);
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
        console.warn(
            `Campo "${nomeCampo}" não encontrado no HTML — confira o atributo name.`
        );
        return;
    }

    campo.addEventListener('input', agendarSalvamento);
});

// ── Supabase ────────────────────────────────────────────────
const SUPABASE_URL = 'https://rvjzqkbsutrbrpufbyiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2anpxa2JzdXRyYnJwdWZieWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDk5ODAsImV4cCI6MjA5OTcyNTk4MH0.IkRhmcK-I69lmhOOjKhzNqJEBe8LRypQOg3KAeJjpj4';

let supabaseClient = null;

try {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
} catch (erro) {
    console.error('Não foi possível iniciar o Supabase:', erro);
}

function atualizarUrlComFicha(id) {
    const params = new URLSearchParams(window.location.search);

    if (usuarioLogado) {
        params.set('usuario', usuarioLogado);
    }

    params.set('ficha', id);

    window.history.replaceState(
        {},
        '',
        `${window.location.pathname}?${params.toString()}`
    );
}

async function resolverFichaDoUsuario() {
    if (!supabaseClient) return false;

    // Jogadores sempre entram na ficha vinculada ao login,
    // independentemente de um ?ficha=... colocado manualmente na URL.
    if (nomeFichaVinculada) {
        const { data, error } = await supabaseClient
            .from('ficha')
            .select('id, nome')
            .eq('nome', nomeFichaVinculada)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Erro ao localizar a ficha do tripulante:', error);
            alert('Não foi possível localizar sua ficha no banco de dados.');
            return false;
        }

        if (!data) {
            console.error(
                `Nenhuma ficha encontrada com o nome exato: ${nomeFichaVinculada}`
            );

            alert(
                `Não encontrei a ficha "${nomeFichaVinculada}" no Supabase.`
            );

            return false;
        }

        FICHA_ID = data.id;
        atualizarUrlComFicha(FICHA_ID);

        // O nome é a chave usada para reencontrar a ficha no próximo login.
        // Por isso ele fica somente para leitura para os jogadores.
        if (campos.nome) {
            campos.nome.readOnly = true;
            campos.nome.title =
                'Nome vinculado ao login deste tripulante.';
        }

        if (botaoNovaFicha) {
            botaoNovaFicha.hidden = true;
        }

        return true;
    }

    // ADM (ou outro login sem vínculo) continua podendo acessar fichas
    // específicas por UUID e criar fichas novas.
    const params = new URLSearchParams(window.location.search);
    const fichaDaUrl = params.get('ficha');

    if (fichaDaUrl) {
        FICHA_ID = fichaDaUrl;
        return true;
    }

    FICHA_ID = crypto.randomUUID();
    atualizarUrlComFicha(FICHA_ID);
    return true;
}

async function carregarFicha() {
    if (!supabaseClient || !FICHA_ID) return;

    const { data, error } = await supabaseClient
        .from('ficha')
        .select('*')
        .eq('id', FICHA_ID)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar ficha:', error);
        return;
    }

    if (!data) {
        // Para o ADM uma ficha UUID nova pode ainda não existir.
        return;
    }

    if (campos.nome) {
        campos.nome.value = data.nome ?? '';
    }

    if (campos.caracteristicas) {
        campos.caracteristicas.value = data.caracteristicas ?? '';
    }

    if (campos.inventario) {
        campos.inventario.value = data.inventario ?? '';
    }

    if (campos.caracteristicasEspeciais) {
        campos.caracteristicasEspeciais.value =
            data.caracteristicas_especiais ?? '';
    }

    definirNivel(
        (data.sanidade ?? []).filter(Boolean).length
    );
}

async function salvarFicha() {
    if (!supabaseClient || !FICHA_ID) return;

    const sanidade = Array.from(segmentos).map((segmento) =>
        segmento.classList.contains('preenchido')
    );

    const nomeParaSalvar = nomeFichaVinculada
        ? nomeFichaVinculada
        : (campos.nome?.value ?? '');

    const { error } = await supabaseClient
        .from('ficha')
        .upsert({
            id: FICHA_ID,
            nome: nomeParaSalvar,
            caracteristicas: campos.caracteristicas?.value ?? '',
            inventario: campos.inventario?.value ?? '',
            caracteristicas_especiais:
                campos.caracteristicasEspeciais?.value ?? '',
            sanidade,
            atualizado_em: new Date().toISOString(),
        });

    if (error) {
        console.error('Erro ao salvar ficha:', error);
    }
}

// Salva 800ms depois da última mudança.
let temporizador;

function agendarSalvamento() {
    clearTimeout(temporizador);
    temporizador = setTimeout(salvarFicha, 800);
}

botaoNovaFicha?.addEventListener('click', (evento) => {
    evento.preventDefault();

    // Jogadores vinculados não devem criar outra ficha por engano.
    if (nomeFichaVinculada) return;

    if (
        confirm(
            'Abrir uma ficha nova em branco? A ficha atual continua salva pelo seu link.'
        )
    ) {
        const destino = new URL(window.location.pathname, window.location.href);

        if (usuarioLogado) {
            destino.searchParams.set('usuario', usuarioLogado);
        }

        window.location.href =
            destino.pathname + destino.search;
    }
});

async function iniciarFicha() {
    if (!supabaseClient) return;

    const resolveu = await resolverFichaDoUsuario();

    if (!resolveu) return;

    await carregarFicha();
}

document.addEventListener('DOMContentLoaded', iniciarFicha);
