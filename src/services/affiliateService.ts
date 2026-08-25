import dotenv from 'dotenv';
dotenv.config();

export function extractLink(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

export async function shortenLink(longUrl: string): Promise<string> {
    try {
        const shortRes = await fetch('https://cleanuri.com/api/v1/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'url=' + encodeURIComponent(longUrl)
        });
        if (shortRes.ok) {
            const data = await shortRes.json();
            if (data.result_url) return data.result_url;
        }
    } catch (e) {}
    return longUrl;
}

export async function generateAffiliateMessage(originalLink: string, customTitle?: string, oldPrice?: string, newPrice?: string, coupon?: string, instructions?: string, secondaryLink?: string): Promise<string> {
    const affiliateTag = process.env.AFFILIATE_TAG || 'minhatag-20';
    let title = customTitle ? customTitle.trim() : "SUPER OFERTA DETECTADA!";

    const convertLink = async (link: string): Promise<string> => {
        let convertedLink = link;
        if (link.includes('amazon.com.br') || link.includes('amzn.to') || link.includes('link.amazon')) {
            try {
                let targetUrl = link;
                if (link.includes('amzn.to') || link.includes('link.amazon') || link.includes('/dp/') || link.includes('/d/') || link.includes('amzlinks.in')) {
                    const response = await fetch(link);
                    targetUrl = response.url || link;
                }
                const url = new URL(targetUrl);
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
                    // Se for um deep link, extrai a URL alvo de dentro dele em vez de tentar dar fetch
                    if (link.includes('deep_link.htm') && link.includes('dl_target_url=')) {
                        const deepLinkUrl = new URL(link);
                        const innerUrl = deepLinkUrl.searchParams.get('dl_target_url');
                        if (innerUrl) {
                            targetUrl = innerUrl;
                        }
                    } else {
                        const response = await fetch(link, { redirect: 'manual' });
                        targetUrl = response.headers.get('location') || link;
                        if (targetUrl.includes('/e/') || targetUrl.includes('a.aliexpress.com') || targetUrl.includes('s.click.aliexpress.com')) {
                            const response2 = await fetch(targetUrl, { redirect: 'manual' });
                            targetUrl = response2.headers.get('location') || targetUrl;
                        }
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
                urlObj.searchParams.delete('from');
                urlObj.searchParams.delete('afSmartRedirect');
                urlObj.searchParams.delete('utm_source');
                urlObj.searchParams.delete('utm_medium');
                urlObj.searchParams.delete('utm_campaign');
                urlObj.searchParams.delete('utm');
                
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
        } else if (link.includes('mercadolivre.com.br') || link.includes('meli.la')) {
            try {
                let targetUrl = link;
                if (link.includes('meli.la') || link.includes('/social/')) {
                    // Step 1: Resolve shortlink to /social/ link (if meli.la)
                    if (link.includes('meli.la')) {
                        const response = await fetch(link, { redirect: 'manual' });
                        targetUrl = response.headers.get('location') || link;
                    }

                    // Step 2: Fetch the /social/ page HTML to extract the raw product/item ID
                    const mlCookie = process.env.ML_COOKIE || '';
                    const htmlResponse = await fetch(targetUrl, {
                        headers: {
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                            'cookie': mlCookie
                        }
                    });
                    const text = await htmlResponse.text();
                    
                    if (text.includes('ui-empty-state')) {
                        console.log('🚨 [MERCADO LIVRE] Link social retornou página de erro/indisponível. Ignorando extração de ID falso.');
                        // Deixa a targetUrl como a URL social original. A API pode rejeitar, mas não enviaremos link errado.
                    } else {
                        // Buscar apenas no bloco principal e não nos polycards (recomendações)
                        const polycardIndex = text.indexOf('"polycards"');
                        const safeText = polycardIndex !== -1 ? text.substring(0, polycardIndex) : text;

                        const productIdMatch = safeText.match(/"product_id"\s*:\s*"([^"]+)"/);
                        const itemIdMatch = safeText.match(/"item_id"\s*:\s*"([^"]+)"/);

                        if (productIdMatch && productIdMatch[1] && productIdMatch[1] !== 'NOT_APPLY' && productIdMatch[1].length > 0) {
                            targetUrl = `https://www.mercadolivre.com.br/p/${productIdMatch[1]}`;
                        } else if (itemIdMatch && itemIdMatch[1] && itemIdMatch[1] !== 'NOT_APPLY' && itemIdMatch[1].length > 0) {
                            targetUrl = `https://produto.mercadolivre.com.br/${itemIdMatch[1].replace('MLB', 'MLB-')}`;
                        }
                    }
                }

                const urlObj = new URL(targetUrl);
                urlObj.searchParams.delete('matt_tool');
                urlObj.searchParams.delete('matt_word');
                urlObj.searchParams.delete('af_click_lookback');
                urlObj.searchParams.delete('af_tracker');
                urlObj.searchParams.delete('campaign_id');
                urlObj.searchParams.delete('utm_source');
                urlObj.searchParams.delete('utm_medium');
                urlObj.searchParams.delete('utm_campaign');
                const cleanTargetUrl = urlObj.toString();

                const mlCookie = process.env.ML_COOKIE;
                const mlCsrf = process.env.ML_CSRF;
                const mlTag = process.env.ML_TAG;

                if (mlCookie && mlCsrf && mlTag) {
                    const payload = {
                        "tag": mlTag,
                        "type": "product",
                        "urls": [cleanTargetUrl],
                        "extraCommission": "false"
                    };

                    const res = await fetch('https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink', {
                        method: 'POST',
                        headers: {
                            'accept': 'application/json, text/plain, */*',
                            'accept-language': 'pt-BR,pt;q=0.8',
                            'content-type': 'application/json',
                            'cookie': mlCookie,
                            'origin': 'https://www.mercadolivre.com.br',
                            'referer': 'https://www.mercadolivre.com.br/afiliados/hub',
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
                            'x-csrf-token': mlCsrf
                        },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.urls && data.urls[0] && data.urls[0].short_url) {
                            convertedLink = data.urls[0].short_url;
                        } else {
                            console.error('🚨 [MERCADO LIVRE] Falha ao gerar link (Produto inválido ou Cookie Expirou). Resposta:', JSON.stringify(data));
                            convertedLink = cleanTargetUrl;
                        }
                    } else {
                        console.error(`🚨 [MERCADO LIVRE] SESSÃO DESLOGADA OU ERRO NA API (Status: ${res.status}). É necessário atualizar os Cookies no .env!`);
                        convertedLink = cleanTargetUrl;
                    }
                } else {
                    convertedLink = cleanTargetUrl;
                }
            } catch(e) {}
        } else if (link.includes('shopee.com.br') || link.includes('shope.ee')) {
            let targetUrl = link;
            try {
                if (link.includes('shope.ee') || link.includes('s.shopee.com.br')) {
                     const response = await fetch(link, { redirect: 'manual' });
                     targetUrl = response.headers.get('location') || link;
                }
                const shopeeId = process.env.SHOPEE_AFFILIATE_ID || '';
                // Extrai a URL final limpa se ela tiver redirecionamentos na string
                const urlObj = new URL(targetUrl);
                urlObj.searchParams.delete('aff_id');
                urlObj.searchParams.delete('mmp_pid');
                urlObj.searchParams.delete('utm_source');
                urlObj.searchParams.delete('utm_medium');
                urlObj.searchParams.delete('utm_campaign');
                
                if (shopeeId) {
                     const longLink = `https://shopee.com.br/universal-link?redir=${encodeURIComponent(urlObj.toString())}&smtt=0.0.9&aff_id=${shopeeId}&utm_source=an_${shopeeId}&utm_medium=affiliates`;
                     convertedLink = await shortenLink(longLink);
                } else {
                     convertedLink = urlObj.toString();
                }
            } catch (e) {}
        }
        return convertedLink;
    };

    let affiliateLink = await convertLink(originalLink);
    let affiliateSecondaryLink = secondaryLink ? await convertLink(secondaryLink) : null;
    
    let message = '';
    
    if (instructions) {
        message += `${instructions}\n`;
    }
    
    message += `${title}\n\n`;
    
    let priceToShow = newPrice || oldPrice;
    if (priceToShow) {
        // Se houver preço antigo e preço novo
        if (oldPrice && newPrice) {
            const oldP = oldPrice.toLowerCase().includes("r$") ? oldPrice : `R$ ${oldPrice}`;
            const newP = newPrice.toLowerCase().includes("r$") ? newPrice : `R$ ${newPrice}`;
            message += `De ${oldP.replace('De: ', '')} por ${newP} 🦸🏻‍♂️\n`;
        } else {
            const p = priceToShow.toLowerCase().includes("r$") ? priceToShow : `R$ ${priceToShow}`;
            message += `Por ${p} 🦸🏻‍♂️\n`;
        }
    } else {
        message += `Preço Especial no link! 🦸🏻‍♂️\n`;
    }

    if (coupon) {
        message += `Cupom: ${coupon} 🎟️\n`;
    }

    message += `\n`; // Quebra de linha antes do link

    if (affiliateSecondaryLink) {
        if (affiliateLink.includes('coin-index') || affiliateSecondaryLink.includes('coin-index')) {
            const coinLink = affiliateLink.includes('coin-index') ? affiliateLink : affiliateSecondaryLink;
            const directLink = affiliateLink.includes('coin-index') ? affiliateSecondaryLink : affiliateLink;
            message += `Link com moedas 🪙\n${coinLink}\n\n`;
            message += `Link direto 👇\n${directLink}\n\n`;
        } else {
            message += `${affiliateLink}\n`;
            message += `${affiliateSecondaryLink}\n\n`;
        }
    } else {
        if (affiliateLink.includes('coin-index')) {
            message += `Link com moedas 🪙\n${affiliateLink}\n\n`;
        } else {
            message += `${affiliateLink}\n\n`;
        }
    }

    message += `(ANUNCIO)\n\n`;
    message += `🏆Amazon prime (30 dias grátis)\n`;
    message += `https://www.amazon.com.br/prime?tag=${affiliateTag}\n\n`;
    message += `*(⚠️ O preço ou estoque pode sofrer alterações pela loja sem aviso prévio)*`;

    return message;
}
