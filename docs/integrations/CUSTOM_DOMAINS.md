# Domínio personalizado das clínicas — arquitetura futura (não implementado)

O campo "Domínio personalizado" no editor continua marcado **em breve** e não faz nada. Para funcionar de verdade são necessários:

1. **Verificação de titularidade:** a clínica cria um registro TXT (`_cliva-verify.<domínio>`) com um token gerado pela Cliva; só depois de verificado o domínio é aceito. Evita que alguém aponte o domínio de outra pessoa.
2. **Registro na Vercel:** adicionar o domínio ao projeto pela API da Vercel (`POST /v10/projects/{id}/domains`), que emite o certificado TLS automaticamente após o CNAME (`cname.vercel-dns.com`) ou registro A.
3. **Roteamento:** o `proxy.ts` lê o `Host`, consulta uma tabela `custom_domains` (domínio → clínica, verificado, ativo) e reescreve para `/<identificador>/...`. O `Host` só é confiável depois de conferido nessa tabela.
4. **SEO:** a URL canônica passa a ser o domínio da clínica; `cliva.me/<identificador>/<funil>` aponta para ela.
5. **Remoção segura:** ao remover, tirar da Vercel e da tabela; o domínio volta a 404 em vez de servir outro conteúdo.
6. **Conflitos:** um domínio só pode pertencer a uma clínica; subdomínios de `cliva.me` são reservados.
7. **Cookies e consentimento:** a escolha de cookies é por domínio; o aviso aparece de novo no domínio próprio.

Custo: a Vercel limita domínios por projeto conforme o plano. Avaliar antes de oferecer a todos os planos.
