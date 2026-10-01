-- =========================================================
-- SINGULARIDADE / DIÁRIO DE BORDO
-- Configuração única para anexar imagens do computador.
--
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.
-- Ele NÃO altera as tabelas ficha, posts ou pastas.
-- =========================================================

-- Cria (ou atualiza) o bucket usado pelo Diário.
insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'blog-imagens',
    'blog-imagens',
    true,
    8388608,
    array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ]
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Como o site é de uso privado entre o grupo de RPG e usa a anon key
-- diretamente no navegador, estas políticas permitem ao frontend
-- ler, enviar e apagar arquivos SOMENTE neste bucket.

drop policy if exists "singularidade_blog_imagens_select"
on storage.objects;

create policy "singularidade_blog_imagens_select"
on storage.objects
for select
to public
using (
    bucket_id = 'blog-imagens'
);

drop policy if exists "singularidade_blog_imagens_insert"
on storage.objects;

create policy "singularidade_blog_imagens_insert"
on storage.objects
for insert
to public
with check (
    bucket_id = 'blog-imagens'
);

drop policy if exists "singularidade_blog_imagens_update"
on storage.objects;

create policy "singularidade_blog_imagens_update"
on storage.objects
for update
to public
using (
    bucket_id = 'blog-imagens'
)
with check (
    bucket_id = 'blog-imagens'
);

drop policy if exists "singularidade_blog_imagens_delete"
on storage.objects;

create policy "singularidade_blog_imagens_delete"
on storage.objects
for delete
to public
using (
    bucket_id = 'blog-imagens'
);
