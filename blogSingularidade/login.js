// Login simples, sem backend de autenticação — combina com o clima "in RPG" do pedido.
// Isso NÃO é seguro de verdade: qualquer um que abrir o código-fonte (F12) vê as senhas.
// Serve pra afastar visitante casual, não pra proteger nada sensível.
const CONTAS = {
    harvey: '001',
    maggie: '002',
    liam: '003',
    rik: '004',
    nicollo: '005',
    leano: '006',
    adm: 'admin'
};

const form = document.getElementById('form-login');
const mensagemErro = document.getElementById('mensagem-erro');

form.addEventListener('submit', (evento) => {
    evento.preventDefault();

    const nomeDigitado = document.getElementById('nome').value.trim();
    const senhaDigitada = document.getElementById('senha').value.trim();
    const chave = nomeDigitado.toLowerCase();

    if (CONTAS[chave] && CONTAS[chave] === senhaDigitada) {
        const nomeFormatado = chave.charAt(0).toUpperCase() + chave.slice(1);
        // Sem cookies/localStorage — o login "viaja" pela própria URL da página seguinte.
        window.location.href = `blog.html?usuario=${encodeURIComponent(nomeFormatado)}`;
    } else {
        mensagemErro.classList.add('visivel');
    }
});