import dotenv from 'dotenv';
dotenv.config();

export function extractLink(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

export async function generateAffiliateMessage(originalLink: string, customTitle?: string, oldPrice?: string, newPrice?: string): Promise<string> {
    const affiliateTag = process.env.AFFILIATE_TAG || 'minhatag-20';
    let affiliateLink = originalLink;
    
    // Se o Admin enviou um título ou preço junto com o comando, usamos eles. Se não, usamos o padrão.
    let title = customTitle ? `🔥 *${customTitle.trim()}* 🔥` : "🔥 *SUPER OFERTA DETECTADA!* 🔥";
    
    let priceSection = "";
    if (oldPrice && newPrice) {
        priceSection = `❌ De: ~${oldPrice.trim()}~\n✅ Por apenas: *${newPrice.trim()}*`;
    } else if (oldPrice && !newPrice) {
        priceSection = `💸 Por apenas: *${oldPrice.trim()}*`;
    } else {
        priceSection = `💸 Preço Especial!`;
    }

    if (originalLink.includes('amazon.com.br') || originalLink.includes('amzn.to') || originalLink.includes('link.amazon')) {
        try {
            const url = new URL(originalLink);
            url.searchParams.set('tag', affiliateTag);
            affiliateLink = url.toString();
        } catch(e) {}
    } else if (originalLink.includes('aliexpress.com') || originalLink.includes('ali.ski')) {
        try {
            const aliExpressShortKey = process.env.ALIEXPRESS_KEY || '_c39LG19l';
            let targetUrl = originalLink;
            
            // Desencurta o link para pegar o URL real do produto
            if (originalLink.includes('/e/') || originalLink.includes('a.aliexpress.com') || originalLink.includes('s.click.aliexpress.com') || originalLink.includes('ali.ski')) {
                const response = await fetch(originalLink, { redirect: 'manual' });
                targetUrl = response.headers.get('location') || originalLink;
                
                // Trata duplo redirect que às vezes acontece
                if (targetUrl.includes('/e/') || targetUrl.includes('a.aliexpress.com') || targetUrl.includes('s.click.aliexpress.com')) {
                    const response2 = await fetch(targetUrl, { redirect: 'manual' });
                    targetUrl = response2.headers.get('location') || targetUrl;
                }
            }

            // Remove todos os parâmetros de comissão do dono do grupo
            const urlObj = new URL(targetUrl);
            const cleanTargetUrl = urlObj.origin + urlObj.pathname; 

            // Monta o seu link comissionado
            affiliateLink = `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${aliExpressShortKey}&dl_target_url=${encodeURIComponent(cleanTargetUrl)}`;
        } catch (e) {
            console.error('Erro na conversão do AliExpress:', e);
        }
    }
    
    const message = `
${title}

${priceSection}
🛍️ *Compre aqui:* ${affiliateLink}

🚀 _Promoção por tempo limitado!_
    `.trim();

    return message;
}
