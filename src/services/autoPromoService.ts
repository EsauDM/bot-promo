import { generateAffiliateMessage } from './affiliateService';
import { getDb } from '../database/db';
import { getActiveGroups } from '../database/groupRepository';

const TELEGRAM_CHANNELS = [
    // Canais focados em Hardware e Gamer
    'https://t.me/s/nerdofertas',
    'https://t.me/s/promosadrenaline',
    'https://t.me/s/pcbuildbr',
    'https://t.me/s/ofertas_pc_gamer',
    'https://t.me/s/PromosGamerBR',
    'https://t.me/s/BenchPromos',
    'https://t.me/s/gatunodeofertas',
    'https://t.me/s/TioBalaOfertas',
    'https://t.me/s/DicasPC',
    'https://t.me/s/ofertas_gamer',
    
    // Canais Gigantes Genéricos
    'https://t.me/s/pelando',
    'https://t.me/s/promobit',
    'https://t.me/s/canaltech_ofertas',
    'https://t.me/s/ofertastecnoblog',
    'https://t.me/s/QualyPromo',
    'https://t.me/s/promosninjas',
    'https://t.me/s/PromocoeseOfertas',
    
    // Focados em AliExpress e Amazon
    'https://t.me/s/achados_ali',
    'https://t.me/s/promoaliexpressbrasil',
    'https://t.me/s/ofertas_amazon_brasil',
    'https://t.me/s/aliexpressbr_oficial',
    'https://t.me/s/cupons_ali',
    'https://t.me/s/promos_amazon_br'
];

export async function initAutoPromo(socket: any) {
    // Inicia a verificação a cada 5 minutos (300000 ms)
    setInterval(() => checkAndSendPromo(socket), 300000);
    // Também faz uma busca logo que iniciar
    setTimeout(() => checkAndSendPromo(socket), 15000);
}

const decodeHtml = (text: string) => text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#036;/g, '$');

interface Promo {
    link: string;
    secondaryLink?: string;
    title?: string;
    oldPrice?: string;
    price?: string;
    coupon?: string;
    instructions?: string;
    photoUrl?: string;
}

async function scrapeOffers(): Promise<Promo[]> {
    const promos: Promo[] = [];
    
    for (const channelUrl of TELEGRAM_CHANNELS) {
        try {
            const response = await fetch(channelUrl);
            if (!response.ok) continue;

            const html = await response.text();
            
            // Extrai o bloco inteiro da mensagem (foto + texto)
            const blocks = [...html.matchAll(/<div class="tgme_widget_message text_not_supported_wrap[^>]*>(.*?)<div class="tgme_widget_message_footer/gs)];
            
            for (const block of blocks) {
                const blockHtml = block[1];
                const textMatch = blockHtml.match(/<div class="tgme_widget_message_text[^>]*>(.*?)<\/div>/s);
                if (!textMatch) continue;
                
                const msgHtml = textMatch[1];
                const lowerHtml = msgHtml.toLowerCase();
                
                const photoMatch = blockHtml.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/);
                let photoUrl = photoMatch ? photoMatch[1] : undefined;
                if (photoUrl && photoUrl.startsWith('//')) {
                    photoUrl = 'https:' + photoUrl;
                }
                
                // Filtro Positivo
                const pcKeywords = [
                    'pc ', 'computador', 'gamer', 'placa de vídeo', 'placa-mãe', 'placa mãe', 'processador',
                    'ryzen', 'intel', 'core i', 'memória ram', 'ddr4', 'ddr5', 'ssd', 'nvme', 'm.2', 'hd ', 'disco rígido',
                    'gabinete', 'fonte', 'water cooler', 'watercooler', 'air cooler', 'rtx', 'gtx', 'rx ',
                    'radeon', 'nvidia', 'amd', 'mouse', 'teclado', 'headset', 'monitor', 'cadeira gamer',
                    'joystick', 'gamepad', 'controle', 'nintendo switch', 'playstation', 'xbox',
                    'ps4', 'ps5', 'xbox series', 'notebook', 'laptop', 'macbook', 'setup',
                    'fone de ouvido', 'microfone', 'webcam', 'roteador', 'pendrive', 'micro sd',
                    'celular', 'smartphone', 'iphone', 'galaxy', 'poco', 'xiaomi', 'smart tv', 'tv '
                ];

                // Ignorar eletrodomésticos, cozinha, higiene e cosméticos (Filtro negativo)
                const ignoreKeywords = [
                    'liquidificador', 'fritadeira', 'airfryer', 'fralda', 'sabão', 'sabonete', 'shampoo', 
                    'desodorante', 'cafeteira', 'geladeira', 'fogão', 'microondas', 'micro-ondas', 'aspirador', 
                    'ferro de passar', 'perfume', 'maquiagem', 'creme', 'multiprocessador', 'oster', 'batedeira', 
                    'mixer', 'panela', 'forno', 'gloss', 'batom', 'skincare', 'hidratante', 'cabelo'
                ];

                const isPcOrPeripheral = pcKeywords.some(keyword => {
                    const kw = keyword.trim();
                    if (['pc', 'hd', 'tv', 'rx', 'gtx', 'rtx', 'iphone', 'macbook', 'ipad', 'ssd'].includes(kw)) {
                        return new RegExp(`\\b${kw}\\b`, 'i').test(lowerHtml);
                    }
                    return lowerHtml.includes(keyword);
                });
                
                const shouldIgnore = ignoreKeywords.some(keyword => lowerHtml.includes(keyword));

                if (!isPcOrPeripheral || shouldIgnore) {
                    continue; 
                }

                if (lowerHtml.includes('amzn.to') || lowerHtml.includes('amazon.com') || lowerHtml.includes('link.amazon') || lowerHtml.includes('aliexpress.com') || lowerHtml.includes('ali.ski') || lowerHtml.includes('mercadolivre.com.br') || lowerHtml.includes('meli.la') || lowerHtml.includes('shopee.com.br') || lowerHtml.includes('shope.ee')) {
                    const allUrls = [...msgHtml.matchAll(/href="(https:\/\/[^"]+)"/g)].map(m => m[1]);
                    if (allUrls.length > 0) {
                        let originalLink = allUrls[0];
                        let secondaryLink = allUrls.length > 1 ? allUrls[1] : undefined;

                        if (originalLink.includes('coin-index') && secondaryLink) {
                            const temp = originalLink;
                            originalLink = secondaryLink;
                            secondaryLink = temp;
                        }
                        
                        const decodedMsgHtml = decodeHtml(msgHtml);

                        // Extrai o preço (ex: R$ 1.200,00)
                        const priceMatch = decodedMsgHtml.match(/R\$\s*[\d\.,]+/i);
                        const price = priceMatch ? priceMatch[0] : undefined;

                        // Pega a linha original que continha o preço (para ver se tinha um "De: " ou "Por: ")
                        let oldPrice;
                        if (price && decodedMsgHtml.includes('De:')) {
                            const oldPriceMatch = decodedMsgHtml.match(/De:\s*R\$\s*[\d\.,]+/i);
                            if (oldPriceMatch) {
                                oldPrice = oldPriceMatch[0];
                            }
                        }

                        // Função para limpar tags HTML
                        const stripHtml = (text: string) => text.replace(/<[^>]*>?/gm, '').trim();

                        // Extrai título (pega a primeira linha útil)
                        let title;
                        const lines = msgHtml.split(/<br\s*\/?>/i);
                        if (lines.length > 0) {
                            title = decodeHtml(stripHtml(lines[0]));
                        }

                        // Extrai cupom
                        let coupon;
                        const couponMatch = msgHtml.match(/cupom:?\s*([A-Za-z0-9]+)/i);
                        if (couponMatch) {
                            coupon = couponMatch[1];
                        }

                        // Extrai as instruções de compra (Filtro para ignorar ad de outros canais)
                        let instructions;
                        const adKeywords = ['t.me', 'grupo', 'nerdofertas', 'ofertas', 'inscreva', 'link'];
                        
                        if (lines.length > 1) {
                            for (let j = 1; j < lines.length; j++) {
                                // Limpa tags HTML da linha para não vazar código de emoji
                                const cleanLine = stripHtml(decodeHtml(lines[j]));
                                if (!cleanLine) continue;

                                const lowLine = cleanLine.toLowerCase();
                                const isAd = adKeywords.some(ad => lowLine.includes(ad));
                                
                                // Não pega linhas que tenham preço, link, cupom ou propagandas
                                if (!lowLine.includes('r$') && !lowLine.includes('http') && !lowLine.includes('cupom') && !isAd) {
                                    // Ignora linhas inúteis genéricas
                                    if (cleanLine.length > 3) {
                                        instructions = cleanLine;
                                        break;
                                    }
                                }
                            }
                        }

                        promos.push({ link: originalLink, secondaryLink, title, oldPrice, price, coupon, instructions, photoUrl });
                    }
                }
            }
        } catch (error) {
            console.error(`Erro ao buscar ofertas de ${channelUrl}:`, error);
        }
    }
    
    return promos;
}

async function checkAndSendPromo(socket: any) {
    try {
        console.log('🔄 [AutoPromo] Buscando novas ofertas de tecnologia e hardware...');
        
        const promos = await scrapeOffers();
        if (promos.length === 0) return;

        const db = await getDb();
        const activeGroups = await getActiveGroups();
        if (activeGroups.length === 0) return;

        let sentCount = 0;
        // Processa todas as promoções encontradas (da mais antiga para a mais nova)
        for (const promo of promos.reverse()) {
            if (sentCount >= 5) {
                console.log(`⏳ [AutoPromo] Limite de 5 ofertas atingido neste ciclo. As demais ficam para os próximos minutos.`);
                break;
            }

            // Verifica se já enviamos essa promoção
            try {
                const row = await db.get('SELECT link FROM sent_promos WHERE link = ?', [promo.link]);
                if (row) {
                    continue; // Já enviada, pula pra próxima
                }
            } catch (err) {
                console.error('Erro ao verificar banco:', err);
            }

            try {
                const message = await generateAffiliateMessage(promo.link, promo.title, promo.oldPrice, promo.price, promo.coupon, promo.instructions, promo.secondaryLink);
                if (!message) continue;

                console.log(`🚀 [AutoPromo] Disparando nova oferta: ${promo.title || 'Oferta'}`);
                
                for (const groupId of activeGroups) {
                    try {
                        if (promo.photoUrl) {
                            let imagePayload: any = { url: promo.photoUrl };
                            
                            // Tenta baixar a imagem com fetch para evitar bloqueios do Baileys
                            try {
                                let downloadUrl = promo.photoUrl;
                                if (downloadUrl.startsWith('//')) {
                                    downloadUrl = 'https:' + downloadUrl;
                                }
                                
                                const imgRes = await fetch(downloadUrl);
                                if (imgRes.ok) {
                                    const arrayBuffer = await imgRes.arrayBuffer();
                                    imagePayload = Buffer.from(arrayBuffer);
                                }
                            } catch (downloadErr) {
                                console.error('Erro ao baixar imagem manualmente:', downloadErr);
                            }

                            await socket.sendMessage(groupId, { image: imagePayload, caption: message });
                        } else {
                            await socket.sendMessage(groupId, { text: message });
                        }
                    } catch (err) {
                        console.error(`Erro ao enviar para o grupo ${groupId}:`, err);
                    }
                }

                // Salva no banco que enviamos
                try {
                    await db.run('INSERT INTO sent_promos (link) VALUES (?)', [promo.link]);
                    sentCount++;
                    // Delay de 10s entre ofertas enviadas
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } catch (err2) {
                    console.error('Falha ao salvar promo no BD', err2);
                }
            } catch (err) {
                console.error('Erro ao processar oferta:', err);
            }
        }
    } catch (error) {
        console.error('Erro no auto promo:', error);
    }
}
