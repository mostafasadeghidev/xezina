<div align="center">

<img src="../logo.png" width="88" alt="Logo do Xezina">

# Xezina

**Seus favoritos, em todos os navegadores — organizados, pesquisáveis e guardados onde *você* escolher.**

[![Release](https://img.shields.io/github/v/release/mostafasadeghidev/xezina?color=5b5bf0&label=release)](https://github.com/mostafasadeghidev/xezina/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/mostafasadeghidev/xezina/ci.yml?label=tests)](https://github.com/mostafasadeghidev/xezina/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Chrome · Edge · Firefox · Brave](https://img.shields.io/badge/browsers-Chrome%20·%20Edge%20·%20Firefox%20·%20Brave-555)

[English](../../README.md) · [فارسی](README.fa.md) · [کوردی](README.ckb.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Italiano](README.it.md) · **Português**

[Site](https://mostafasadeghidev.github.io/xezina/) · [Baixar](https://github.com/mostafasadeghidev/xezina/releases/latest) · [Privacidade](https://mostafasadeghidev.github.io/xezina/privacy.html)

<img src="../screenshots/library-dark.png" alt="Biblioteca do Xezina" width="900">

</div>

## Por que o Xezina?

Você salva centenas de páginas, depois não consegue encontrá-las, e cada navegador tem um conjunto diferente.
O Xezina resolve as duas coisas:

- **Um único conjunto de favoritos em todo lugar.** Chrome, Edge, Brave, Opera, Vivaldi e Firefox ficam idênticos.
- **Uma biblioteca em que dá para pesquisar de verdade.** Notas, tags, prévias e busca instantânea em tudo.
- **Sem conta, sem servidor nosso.** Seus dados ficam na sua própria nuvem ou no seu próprio servidor.

## Recursos

| | |
|---|---|
| 🔄 **Sincronização bidirecional de verdade** | Alterações feitas ao mesmo tempo em navegadores diferentes são mescladas campo a campo. Uma renomeação em um navegador e uma movimentação em outro são ambas preservadas. |
| ☁️ **Armazenamento à sua escolha** | Google Drive, Dropbox, OneDrive, WebDAV/Nextcloud, S3/Cloudflare R2 ou um repositório privado no GitHub. |
| 🔎 **Pesquise em tudo** | Títulos, endereços, suas notas, tags, nomes de pastas e descrições de páginas. Tolera erros de digitação e entende variantes de letras persas/árabes. Use os filtros `#tag` e `site:example.com`, ou digite `bm` + espaço na barra de endereços. |
| 🔎 **Busca rápida** | Pressione <kbd>Ctrl</kbd>+<kbd>K</kbd> em qualquer lugar do Xezina: uma busca flutuante com sugestões ao vivo e prévia de cada resultado. |
| ⭐ **Funciona com a estrela do navegador** | Salve com a estrela ou Ctrl+D como sempre: o Xezina adiciona uma captura e a descrição da página e depois deixa você adicionar notas. Ou pressione <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>. |
| 🏷️ **Títulos curtos continuam curtos** | Mantenha um título de uma letra (ou nenhum) na barra de favoritos; o Xezina mostra um nome de exibição e o título real da página, e encontra o favorito pelos dois. |
| 📝 **Notas e tags** | Escreva por que você salvou uma página e adicione tags. Notas e tags são sincronizadas junto com o favorito. |
| 🖼️ **Prévias** | A imagem de prévia do próprio site, ou uma captura de tela feita quando você visita uma página salva nos favoritos. |
| 🧹 **Ferramentas de limpeza** | Encontre duplicados e links quebrados. Mova, marque com tags ou exclua muitos favoritos de uma vez, ou arraste-os para uma pasta. |
| 🔐 **Criptografia de ponta a ponta** | Opcional. Os dados são criptografados no seu navegador com a sua senha (AES-256-GCM) antes de serem enviados. |
| 🛟 **Rede de segurança** | Backup automático antes de cada sincronização, restauração com um clique e uma confirmação antes de qualquer sincronização que excluiria muitos favoritos. |
| 🌍 **8 idiomas** | English, فارسی, کوردی (سۆرانی), العربية, Deutsch, Français, Italiano, Português — com layout completo da direita para a esquerda. |

<div align="center">
<img src="../screenshots/details.png" alt="Notas e tags" width="440">
<img src="../screenshots/dashboard.png" alt="Painel" width="440">
</div>

## Opções de armazenamento

| Armazenamento | Ideal para | O que você precisa |
|---|---|---|
| **Google Drive** | todos | entrar na conta — os arquivos vão para uma pasta oculta do app |
| **Dropbox** | todos | entrar na conta — os arquivos vão para `Apps/Xezina` |
| **OneDrive** | todos | entrar na conta — os arquivos vão para `Apps/Xezina` |
| **WebDAV** | Nextcloud, ownCloud, Synology, QNAP, seu próprio servidor | endereço, nome de usuário, senha de app |
| **Compatível com S3** | Cloudflare R2, ArvanCloud, AWS S3, MinIO, Backblaze B2 | endpoint, bucket, chaves de acesso |
| **GitHub** | desenvolvedores; histórico completo de versões | um token de acesso refinado (fine-grained) (o Xezina cria um repositório privado) |

## Instalação

1. Baixe o zip mais recente em **[Releases](https://github.com/mostafasadeghidev/xezina/releases/latest)**.
2. **Chrome, Edge, Brave, Opera, Vivaldi:** descompacte `xezina-*-chrome.zip` → abra `chrome://extensions`
   (`edge://extensions` no Edge) → ative o **Developer mode** (modo do desenvolvedor) → **Load unpacked** (carregar sem compactação) → escolha a pasta descompactada.
3. **Firefox:** use `xezina-*-firefox.zip`. Uma versão assinada será publicada em addons.mozilla.org.

Mantenha a pasta descompactada no lugar: o navegador carrega a extensão a partir dela.

## Primeiros passos

1. Abra o Xezina com <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>, ou clique no ícone da barra de ferramentas → o botão de grade.
2. Vá em **Configurações → Sincronização**, escolha um armazenamento e conecte.
3. Instale o Xezina nos seus outros navegadores e conecte-os **ao mesmo armazenamento**.
   Se você usa criptografia, digite a mesma senha.
4. Pronto. Seus favoritos aparecem na barra e no menu de favoritos de cada navegador. Abra o gerenciador
   do Xezina só quando quiser pesquisar, escrever notas ou organizar.

> [!TIP]
> Desative a sincronização de favoritos do próprio navegador (Chrome Sync para favoritos, sincronização de favoritos do Edge)
> nos dispositivos em que o Xezina sincroniza, para que dois sistemas não editem os mesmos favoritos.

> [!NOTE]
> Na primeira vez que um navegador se conecta, os favoritos que ele já compartilha com os outros (mesma pasta,
> mesmo endereço) são associados em vez de duplicados. Para fazer um navegador corresponder **exatamente** à cópia
> da nuvem, use uma vez **Configurações → Sincronização → Fazer este navegador igual à nuvem**. Um backup é feito antes.

## Perguntas frequentes

<details>
<summary><b>O Xezina vê meus favoritos ou minha navegação?</b></summary>

Não. Não existe servidor do Xezina. Tudo vai diretamente do seu navegador para o armazenamento que você
escolheu. As páginas só são lidas se você permitir prévias, e apenas as páginas que você salvou nos favoritos.
</details>

<details>
<summary><b>O que acontece se eu editar o mesmo favorito em dois navegadores?</b></summary>

Cada campo (título, endereço, pasta, posição, notas, tags) é mesclado separadamente, e a alteração mais
recente desse campo prevalece. Alterações diferentes no mesmo favorito são todas mantidas.
</details>

<details>
<summary><b>E se uma sincronização der errado?</b></summary>

O Xezina faz um backup antes de cada sincronização que altera seus favoritos. Restaure qualquer um dos últimos 30
backups em **Configurações → Backups e dados**. Uma sincronização que excluiria muitos favoritos aguarda
a sua confirmação.
</details>

<details>
<summary><b>O login no Google Drive / Dropbox / OneDrive diz que o app não está configurado.</b></summary>

Esses serviços exigem um registro único do app por quem publica o build. Veja
[docs/oauth-setup.md](../oauth-setup.md). WebDAV, S3 e GitHub funcionam sem isso.
</details>

<details>
<summary><b>Posso exportar meus favoritos?</b></summary>

Sim. Exporte para HTML padrão (importável em qualquer navegador) ou JSON (com notas e tags), e
importe arquivos HTML, em **Configurações → Backups e dados**.
</details>

## Como a sincronização funciona

Cada favorito é um registro em que cada campo carrega um carimbo de tempo de relógio lógico híbrido. Cada dispositivo
envia sua cópia mesclada completa como um único arquivo (`devices/<id>.xz`) e lê os arquivos dos outros
dispositivos. A mesclagem fica com o valor mais recente de cada campo, então o resultado é o mesmo em qualquer ordem
em que os arquivos cheguem (um CRDT baseado em estado). Como cada dispositivo grava apenas o próprio arquivo, qualquer
armazenamento de arquivos simples funciona, e dois dispositivos nunca podem sobrescrever um ao outro. Itens excluídos são mantidos como
“tombstones”; uma pasta excluída em um dispositivo que recebe um novo favorito em outro volta com
esse favorito. A ordem dentro das pastas usa indexação fracionária.

## Desenvolvimento

```bash
pnpm install
pnpm dev                 # Chrome with live reload  (pnpm dev:firefox for Firefox)
pnpm test                # unit tests + randomized multi-browser sync simulations
pnpm build && node scripts/e2e.mjs        # two real Edge profiles syncing over WebDAV
pnpm build && node scripts/screenshots.mjs  # regenerate docs/screenshots
pnpm zip && pnpm zip:firefox
```

| Pasta | Conteúdo |
|---|---|
| `src/core` | modelo de dados, mesclagem CRDT, ordenação, busca |
| `src/sync` | leitura/aplicação dos favoritos do navegador, associação no primeiro contato, criptografia |
| `src/storage` | um pequeno adaptador por provedor de armazenamento |
| `src/background` | agendador, prévias, verificador de links |
| `src/ui` | gerenciador, popup, traduções (`src/ui/i18n`) |
| `docs` | site (GitHub Pages), capturas de tela, READMEs traduzidos |

**Apps de login:** Google Drive, Dropbox, OneDrive e “Sign in with GitHub” precisam de client IDs OAuth,
lidos no momento do build a partir de `.env` (veja `.env.example`) ou informados pelos usuários em
**Configurações → Avançado**. Guia passo a passo: [docs/oauth-setup.md](../oauth-setup.md).

**Traduções:** os textos da interface ficam em `src/ui/i18n/<lang>.ts`, e os do site em
`docs/i18n/<lang>.js`. Correções de falantes nativos são muito bem-vindas.

## Licença

[MIT](../../LICENSE) © Mostafa Sadeghi
