import dotenv from 'dotenv';
dotenv.config();

export function extractLink(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

export async function generateAffiliateMessage(originalLink: string, customTitle?: string, oldPrice?: string, newPrice?: string, coupon?: string, instructions?: string, secondaryLink?: string): Promise<string> {
    const affiliateTag = process.env.AFFILIATE_TAG || 'minhatag-20';
    let title = customTitle ? customTitle.trim() : "SUPER OFERTA DETECTADA!";

    const convertLink = async (link: string): Promise<string> => {
        let convertedLink = link;
        if (link.includes('amazon.com.br') || link.includes('amzn.to') || link.includes('link.amazon')) {
            try {
                const url = new URL(link);
                url.searchParams.set('tag', affiliateTag);
                convertedLink = url.toString();
            } catch(e) {}
        } else if (link.includes('aliexpress.com') || link.includes('ali.ski')) {
            try {
                const aliExpressAppKey = process.env.ALIEXPRESS_APP_KEY;
                const aliExpressAppSecret = process.env.ALIEXPRESS_APP_SECRET;
                const aliExpressTrackingId = process.env.ALIEXPRESS_TRACKING_ID;
                let targetUrl = link;
                
                if (link.includes('/e/') || link.includes('a.aliexpress.com') || link.includes('s.click.aliexpress.com') || link.includes('ali.ski')) {
                    const response = await fetch(link, { redirect: 'manual' });
                    targetUrl = response.headers.get('location') || link;
                    if (targetUrl.includes('/e/') || targetUrl.includes('a.aliexpress.com') || targetUrl.includes('s.click.aliexpress.com')) {
                        const response2 = await fetch(targetUrl, { redirect: 'manual' });
                        targetUrl = response2.headers.get('location') || targetUrl;
                    }
                }

                const urlObj = new URL(targetUrl);
                // Remove apenas o rastreio do afiliado original, mantendo parâmetros essenciais (como productIds)
                urlObj.searchParams.delete('aff_fcid');
                urlObj.searchParams.delete('aff_fsk');
                urlObj.searchParams.delete('aff_trace_key');
                urlObj.searchParams.delete('aff_platform');
                urlObj.searchParams.delete('sk');
                urlObj.searchParams.delete('terminal_id');
                urlObj.searchParams.delete('tt');
                
                const cleanTargetUrl = urlObj.toString();

                if (aliExpressAppKey && aliExpressAppSecret && aliExpressTrackingId) {
                    const { AffiliateClient } = require('ae_sdk');
                    const client = new AffiliateClient({ app_key: aliExpressAppKey, app_secret: aliExpressAppSecret });
                    const res = await client.execute('aliexpress.affiliate.link.generate', { promotion_link_type: 0, source_values: cleanTargetUrl, tracking_id: aliExpressTrackingId });
                    
                    if (res.ok && res.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.[0]?.promotion_link) {
                        convertedLink = res.data.aliexpress_affiliate_link_generate_response.resp_result.result.promotion_links[0].promotion_link;
                    } else {
                        console.log('⚠️ [AliExpress API] Link incompatível. Aplicando Plano B (Deep Link Seguro)...');
                        convertedLink = `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${process.env.ALIEXPRESS_KEY || '_c39LG19l'}&dl_target_url=${encodeURIComponent(cleanTargetUrl)}`;
                    }
                } else {
                    convertedLink = `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${process.env.ALIEXPRESS_KEY || '_c39LG19l'}&dl_target_url=${encodeURIComponent(cleanTargetUrl)}`;
                }
            } catch (e) { console.error('Erro na conversão do AliExpress:', e); }
        } else if (link.includes('shopee.com.br') || link.includes('shope.ee')) {
            let targetUrl = link;
            try {
                if (link.includes('shope.ee') || link.includes('s.shopee.com.br')) {
                     const response = await fetch(link, { redirect: 'manual' });
                     targetUrl = response.headers.get('location') || link;
                }
                const shopeeId = process.env.SHOPEE_AFFILIATE_ID || '';
                if (shopeeId) {
                     // Extrai a URL final limpa se ela tiver redirecionamentos na string
                     const urlObj = new URL(targetUrl);
                     urlObj.searchParams.delete('aff_id');
                     urlObj.searchParams.delete('mmp_pid');
                     urlObj.searchParams.delete('utm_source');
                     urlObj.searchParams.delete('utm_medium');
                     urlObj.searchParams.delete('utm_campaign');
                     
                     convertedLink = `https://shopee.com.br/universal-link?redir=${encodeURIComponent(urlObj.toString())}&smtt=0.0.9&aff_id=${shopeeId}&utm_source=an_${shopeeId}&utm_medium=affiliates`;
                } else {
                     convertedLink = targetUrl;
                }
            } catch (e) {}
        }
        return convertedLink;
    };

    let affiliateLink = await convertLink(originalLink);
    let affiliateSecondaryLink = secondaryLink ? await convertLink(secondaryLink) : null;
    
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

    if (affiliateSecondaryLink) {
        if (affiliateLink.includes('coin-index') || affiliateSecondaryLink.includes('coin-index')) {
            const coinLink = affiliateLink.includes('coin-index') ? affiliateLink : affiliateSecondaryLink;
            const directLink = affiliateLink.includes('coin-index') ? affiliateSecondaryLink : affiliateLink;
            message += `🪙 Link com moedas 👇\n${coinLink}\n\n`;
            message += `🔗 Link direto 👇\n${directLink}\n\n`;
        } else {
            message += `🔗 Opção 1: ${affiliateLink}\n`;
            message += `🔗 Opção 2: ${affiliateSecondaryLink}\n\n`;
        }
    } else {
        if (affiliateLink.includes('coin-index')) {
            message += `🪙 Link com moedas 👇\n${affiliateLink}\n\n`;
        } else {
            message += `🔗 Link direto 👇\n${affiliateLink}\n\n`;
        }
    }

    message += `(ANUNCIO)\n\n`;
    message += `🏆Amazon prime (30 dias grátis)\n`;
    message += `https://amzn.to/4lM3PHH\n\n`;
    message += `*(⚠️ O preço ou estoque pode sofrer alterações pela loja sem aviso prévio)*`;

    return message;
}
