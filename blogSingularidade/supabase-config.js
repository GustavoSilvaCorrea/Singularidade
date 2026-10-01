// Configuração compartilhada do Supabase para o Diário.
// A anon key é própria para uso no frontend.
const SUPABASE_URL = 'https://rvjzqkbsutrbrpufbyiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2anpxa2JzdXRyYnJwdWZieWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDk5ODAsImV4cCI6MjA5OTcyNTk4MH0.IkRhmcK-I69lmhOOjKhzNqJEBe8LRypQOg3KAeJjpj4';

// Observação: a linha acima mantém a chave que o projeto já usava.
// Se você trocar a chave anon no Supabase, atualize este arquivo.

window.SUPABASE_BUCKET_IMAGENS = 'blog-imagens';

try {
    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
} catch (erro) {
    console.error('Não foi possível iniciar o Supabase:', erro);
    window.supabaseClient = null;
}
