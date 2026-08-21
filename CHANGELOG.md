# Logs de Atualização e Correções

## 21 de Agosto de 2026 - Correção de "Connection Closed" e Vazamento de Memória

**Problema:**
O bot apresentava frequentemente erros de `Connection Closed` e `Precondition Required` no envio de mensagens de ofertas, deixando de enviar mensagens para alguns grupos.

**O que causava o problema:**
1. **Memory Leak e Conexões Zumbis:** Ao reconectar o Baileys, antigos `setInterval`s (em `autoPromoService.ts` e `connection.ts`) não eram cancelados. O bot passava a executar o serviço de envio múltiplas vezes usando instâncias velhas de sockets já fechados, gerando os erros.
2. **Rate Limit e Precondition Required:** O envio simultâneo super-rápido para muitos grupos fazia o servidor do WhatsApp rejeitar o upload da mídia/foto.

**Solução:**
- Em `src/whatsapp/connection.ts` e `src/services/autoPromoService.ts`: Foram declaradas variáveis para armazenar os IDs (ex: `flushInterval`, `autoPromoInterval`) permitindo a limpeza com `clearInterval()` / `clearTimeout()` caso a conexão seja reiniciada. Isso previne o acúmulo de processos fantasma.
- Adicionada uma função auxiliar `delay(ms)` em `autoPromoService.ts`. Agora há um pequeno delay de 1.5s entre o envio de grupos para aliviar a carga no Baileys. Se o envio falhar, há um sistema de *retry* (3 tentativas com espera de 3 segundos) para evitar perder grupos devido a falha momentânea de internet.
- Corrigida a expressão regular de extração de cupons para ignorar falsos positivos como `de`, `desconto`, `link` ao ler linhas genéricas como "Resgate aqui seu Cupom de Desconto". Agora, se a primeira menção for genérica, o bot continua procurando pelo código real nas próximas linhas da mensagem.

## 17 de Agosto de 2026 - Correção de Imagens e Preços Automáticos (Amazon e AliExpress)

**Problema:**
As ofertas automáticas da Amazon e do AliExpress não estavam enviando as fotos e os preços (retornando apenas texto com preço genérico "💸 Preço Especial!").

**O que causava o problema:**
1. **Fotos:** O regex antigo (`style="background-image:url(...)`) falhava quando o Telegram Web gerava a tag de imagem acompanhada de dimensões (`style="width:800px;background-image:url(...)`), comum em link previews gerados por links de produtos da Amazon e do AliExpress.
2. **Preços:** O Telegram converte internamente o cifrão (`$`) para o código HTML `&#036;`. O regex de extração de preços buscava exatamente por `R$`, e falhava ao ler `R&#036;`.

**Solução:**
- A expressão regular no arquivo `src/services/autoPromoService.ts` foi alterada de `/tgme_widget_message_photo_wrap[^>]+style="background-image:url\('([^']+)'\)/` para `/tgme_widget_message_photo_wrap[^>]+background-image:url\('([^']+)'\)/`.
- A expressão regular de extração de preços foi atualizada para `/R(?:\$|&#036;)\s?[\d\.,]+/g` e adicionada uma lógica de `.replace('&#036;', '$')` para garantir que a mensagem no WhatsApp mostre "R$" bonitinho.

**Dica para a AWS:**
Sempre que fizer um novo pull na máquina da nuvem, certifique-se de estar dentro do diretório `bot-promo` (`cd bot-promo`) e rode o comando `npm run build` antes de reiniciar o processo (`npx pm2 restart bot-promo` ou `npm start`).
