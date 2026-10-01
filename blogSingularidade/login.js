// Login simples do projeto.
// O personagem autenticado é enviado na URL para a página seguinte.
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

        // Agora o login abre primeiro o terminal HOME.
        window.location.href = `home.html?usuario=${encodeURIComponent(nomeFormatado)}`;
    } else {
        mensagemErro.classList.add('visivel');
    }
});
