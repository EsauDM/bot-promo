# Logs de Atualização e Correções

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
