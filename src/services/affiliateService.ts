import dotenv from 'dotenv';
dotenv.config();

export function extractLink(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

export async function generateAffiliateMessage(originalLink: string, customTitle?: string, oldPrice?: string, newPrice?: string, coupon?: string, instructions?: string): Promise<string> {
    const affiliateTag = process.env.AFFILIATE_TAG || 'minhatag-20';
    let affiliateLink = originalLink;
    
    let title = customTitle ? customTitle.trim() : "SUPER OFERTA DETECTADA!";
    
    if (originalLink.includes('amazon.com.br') || originalLink.includes('amzn.to') || originalLink.includes('link.amazon')) {
        try {
            const url = new URL(originalLink);
            url.searchParams.set('tag', affiliateTag);
            affiliateLink = url.toString();
        } catch(e) {}
    } else if (originalLink.includes('aliexpress.com') || originalLink.includes('ali.ski')) {
        try {
            const aliExpressAppKey = process.env.ALIEXPRESS_APP_KEY;
            const aliExpressAppSecret = process.env.ALIEXPRESS_APP_SECRET;
            const aliExpressTrackingId = process.env.ALIEXPRESS_TRACKING_ID;

            let targetUrl = originalLink;
            
            // Desencurta o link
            if (originalLink.includes('/e/') || originalLink.includes('a.aliexpress.com') || originalLink.includes('s.click.aliexpress.com') || originalLink.includes('ali.ski')) {
                const response = await fetch(originalLink, { redirect: 'manual' });
                targetUrl = response.headers.get('location') || originalLink;
                if (targetUrl.includes('/e/') || targetUrl.includes('a.aliexpress.com') || targetUrl.includes('s.click.aliexpress.com')) {
                    const response2 = await fetch(targetUrl, { redirect: 'manual' });
                    targetUrl = response2.headers.get('location') || targetUrl;
                }
            }

            const urlObj = new URL(targetUrl);
            const cleanTargetUrl = urlObj.origin + urlObj.pathname; 

            // Se o usuário já configurou a API
            if (aliExpressAppKey && aliExpressAppSecret && aliExpressTrackingId) {
                const { AffiliateClient } = require('ae_sdk');
                const client = new AffiliateClient({
                    app_key: aliExpressAppKey,
                    app_secret: aliExpressAppSecret
                });

                const res = await client.execute('aliexpress.affiliate.link.generate', {
                    promotion_link_type: 0,
                    source_values: cleanTargetUrl,
                    tracking_id: aliExpressTrackingId
                });

                if (res.ok && res.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.[0]?.promotion_link) {
                    affiliateLink = res.data.aliexpress_affiliate_link_generate_response.resp_result.result.promotion_links[0].promotion_link;
                } else {
                    // Fallback para deep link (página de moedas, etc)
                    console.log('⚠️ [AliExpress API] Link incompatível. Aplicando Plano B (Deep Link Seguro)...');
                    affiliateLink = `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${process.env.ALIEXPRESS_KEY || '_c39LG19l'}&dl_target_url=${encodeURIComponent(cleanTargetUrl)}`;
                }
            } else {
                // Fallback para deep link caso ainda não tenha as chaves na ENV
                affiliateLink = `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${process.env.ALIEXPRESS_KEY || '_c39LG19l'}&dl_target_url=${encodeURIComponent(cleanTargetUrl)}`;
            }
        } catch (e) {
            console.error('Erro na conversão do AliExpress:', e);
        }
    } else if (originalLink.includes('shopee.com.br') || originalLink.includes('shope.ee')) {
        let targetUrl = originalLink;
        try {
            // Desenrolar o shope.ee se for curto
            if (originalLink.includes('shope.ee')) {
                 const response = await fetch(originalLink, { redirect: 'manual' });
                 targetUrl = response.headers.get('location') || originalLink;
            }
            
            // Link universal shopee: https://shopee.com.br/universal-link/...
            // Precisa do nome de usuário afiliado
            const shopeeId = process.env.SHOPEE_AFFILIATE_ID || '';
            if (shopeeId) {
                 affiliateLink = `https://shopee.com.br/universal-link?redir=${encodeURIComponent(targetUrl)}&smtt=0.0.9&aff_id=${shopeeId}`;
            } else {
                 affiliateLink = targetUrl;
            }
        } catch (e) {}
    }
    
    // Montando o modelo requisitado
    let message = `${title}\n\n`;
    
    if (instructions) {
        message += `${instructions}\n\n`;
    }
    
    let priceToShow = newPrice || oldPrice;
    if (priceToShow) {
        if (priceToShow.toLowerCase().includes("r$")) {
            message += `💵  ${priceToShow}\n`;
        } else {
            message += `💵  R$ ${priceToShow}\n`;
        }
    } else {
        message += `💵  Preço Especial no link!\n`;
    }

    if (coupon) {
        message += `🎟️  Cupom: ${coupon}\n`;
    }

    message += `${affiliateLink}\n\n`;
    message += `(ANUNCIO)\n\n`;
    message += `🏆Amazon prime (30 dias grátis)\n`;
    message += `https://amzn.to/4lM3PHH`;

    return message;
}
