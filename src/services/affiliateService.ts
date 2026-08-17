import dotenv from 'dotenv';
dotenv.config();

export function extractLink(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

export async function generateAffiliateMessage(originalLink: string): Promise<string> {
    // Aqui você implementará a lógica real para gerar o link de afiliado
    // dependendo da loja (Amazon, Shopee, Mercado Livre, etc).
    // Como exemplo, vou mostrar uma lógica mockada.
    
    const affiliateTag = process.env.AFFILIATE_TAG || 'minhatag-20';
    let affiliateLink = originalLink;
    let title = "🔥 *SUPER OFERTA DETECTADA!* 🔥";
    let price = "Preço imperdível";

    if (originalLink.includes('amazon.com.br') || originalLink.includes('amzn.to')) {
        // Exemplo simplificado (para URLs longas)
        const url = new URL(originalLink);
        url.searchParams.set('tag', affiliateTag);
        affiliateLink = url.toString();
    }
    
    // Formata a mensagem lindamente
    const message = `
${title}

💸 ${price}
🛍️ *Compre aqui:* ${affiliateLink}

🚀 _Promoção por tempo limitado!_
    `.trim();

    return message;
}
