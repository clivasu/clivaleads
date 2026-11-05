# App da Cliva no celular (PWA)

O app é instalado pelo navegador, sem App Store ou Google Play. É o mesmo sistema, então toda atualização do site já vale para o app.

## Como a pessoa instala
Configurações → **Baixe o app da Cliva**. O cartão detecta o aparelho:
- **Android (Chrome, Edge, Samsung):** botão **Instalar o app**; sem o botão, instruções pelo menu do navegador.
- **iPhone/iPad:** Compartilhar → Adicionar à Tela de Início.
- **Navegador interno (Instagram, Facebook):** orienta a abrir no Safari ou Chrome.
- **Computador:** QR code para abrir no celular e, no Chrome/Edge, botão para instalar no computador.

## Decisões
- **Só o painel oferece o app.** O manifesto fica em `app/(dashboard)/layout.tsx`: paciente que abre um funil público não recebe convite da Cliva.
- **Nada de dados no aparelho.** `public/sw.js` guarda só a tela "sem conexão" e o ícone. Páginas e APIs vão sempre à rede, porque há dados de saúde. Consequência: sem internet o app não abre a agenda.
- **Sair encerra a sessão de verdade** (`components/dashboard/sign-out-button.tsx`) e recarrega a página para limpar a memória.
- **Editor de funis só em tela grande:** no celular mostra um aviso.

## Limitações
- Não aparece na App Store nem no Google Play. Publicar nas lojas exige conta de desenvolvedor (Apple e Google) e um empacotamento à parte.
- No iPhone o app tem sessão própria: é preciso entrar na conta de novo depois de instalar.
- Notificações no celular (push) ainda não existem.

## Alterar o service worker
Trocar `CACHE` em `public/sw.js` (ex.: `cliva-shell-v2`) ao mudar a tela de aviso ou o ícone.
