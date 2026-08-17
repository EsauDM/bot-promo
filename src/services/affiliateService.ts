import dotenv from 'dotenv';
dotenv.config();

export function extractLink(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

export async function generateAffiliateMessage(originalLink: string, customTitle?: string, customPrice?: string): Promise<string> {
    const affiliateTag = process.env.AFFILIATE_TAG || 'minhatag-20';
    let affiliateLink = originalLink;
    
    // Se o Admin enviou um título ou preço junto com o comando, usamos eles. Se não, usamos o padrão.
    let title = customTitle ? `🔥 *${customTitle.trim()}* 🔥` : "🔥 *SUPER OFERTA DETECTADA!* 🔥";
    let price = customPrice ? customPrice.trim() : "Preço imperdível";

    if (originalLink.includes('amazon.com.br') || originalLink.includes('amzn.to')) {
        try {
            const url = new URL(originalLink);
            url.searchParams.set('tag', affiliateTag);
            affiliateLink = url.toString();
        } catch(e) {}
    }
    // Para Mercado Livre, geralmente você já gera o link encurtado no painel de afiliados deles
    // e manda direto pro bot, então o 'affiliateLink' continuará sendo o link original que você enviou.
    
    const message = `
${title}

💸 ${price}
🛍️ *Compre aqui:* ${affiliateLink}

🚀 _Promoção por tempo limitado!_
    `.trim();

    return message;
}
