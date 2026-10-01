const params = new URLSearchParams(window.location.search);
const usuario = params.get('usuario');

if (!usuario) {
    window.location.href = './index.html';
} else {
    const nomeUsuario = document.getElementById('nome-usuario');
    const linkFicha = document.getElementById('link-ficha');
    const linkDiario = document.getElementById('link-diario');
    const codigoSessao = document.getElementById('codigo-sessao');

    if (nomeUsuario) {
        nomeUsuario.textContent = usuario;
    }

    if (linkFicha) {
        linkFicha.href =
            `../ficha/index.html?usuario=${encodeURIComponent(usuario)}`;
    }

    if (linkDiario) {
        linkDiario.href =
            `./blog.html?usuario=${encodeURIComponent(usuario)}`;
    }

    if (codigoSessao) {
        const codigo = usuario
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 8);

        codigoSessao.textContent =
            `SESSÃO // ${codigo || 'ATIVA'}`;
    }
}
