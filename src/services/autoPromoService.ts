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
    'https://t.me/s/promocoeshardware',
    'https://t.me/s/setupgamer',
    'https://t.me/s/promos_pichau',
    'https://t.me/s/ofertas_kabum',
    
    // Canais Gigantes Genéricos
    'https://t.me/s/pelando',
    'https://t.me/s/promobit',
    'https://t.me/s/canaltech_ofertas',
    'https://t.me/s/ofertastecnoblog',
    'https://t.me/s/QualyPromo',
    'https://t.me/s/promosninjas',
    'https://t.me/s/PromocoeseOfertas',
    'https://t.me/s/promocoesdehoje',
    'https://t.me/s/ofertasdodia',
    'https://t.me/s/promo_imperdiveis',
    'https://t.me/s/boletando',
    
    // Focados em AliExpress e Amazon
    'https://t.me/s/achados_ali',
    'https://t.me/s/promoaliexpressbrasil',
    'https://t.me/s/ofertas_amazon_brasil',
    'https://t.me/s/aliexpressbr_oficial',
    'https://t.me/s/cupons_ali',
    'https://t.me/s/promos_amazon_br',
    'https://t.me/s/achados_amazon_br',
    
    // Focados em Shopee
    'https://t.me/s/achadinhos_shopee_brasil',
    'https://t.me/s/shopee_promos_br',
    'https://t.me/s/ofertas_shopee_br',
    'https://t.me/s/promo_shopee_br',
    'https://t.me/s/shopeebroficial',
    'https://t.me/s/achadosdashopee',
    'https://t.me/s/shopee_promocoes',
    'https://t.me/s/shopee_brasil',
    'https://t.me/s/shopeeachados',
    'https://t.me/s/achadosshopeedodia',
    
    // Beleza, Perfumes e Cosméticos
    'https://t.me/s/promosdeperfumes',
    'https://t.me/s/ofertasmaquiagem',
    'https://t.me/s/promosbeleza',
    'https://t.me/s/perfumesimportados',
    'https://t.me/s/achadinhosdebeleza',
    'https://t.me/s/dicas_de_beleza_ofertas',
    'https://t.me/s/garotasaoferta',
    'https://t.me/s/promosdamaquiagem',
    'https://t.me/s/oboticariopromos',
    'https://t.me/s/naturapromos',
    'https://t.me/s/clubedaspatroas',
    'https://t.me/s/beleza_na_web_ofertas',
    'https://t.me/s/dicas_de_skincare',
    
    // Novas Fontes Massivas (Hardware, Ali, Amazon e Gerais)
    'https://t.me/s/hardware_ofertas',
    'https://t.me/s/BoleteirosHardware',
    'https://t.me/s/Promos_Da_China',
    'https://t.me/s/importabrasil',
    'https://t.me/s/ofertas_amazon_br',
    'https://t.me/s/promos_do_dia',
    'https://t.me/s/melhores_promocoes',
    'https://t.me/s/ofertas_e_cupons',
    'https://t.me/s/garimpando_ofertas',
    'https://t.me/s/aliexpress_promos_br',
    'https://t.me/s/descontos_br',
    'https://t.me/s/guia_de_ofertas',
    'https://t.me/s/economiza_brasil',
    'https://t.me/s/promos_online',
    'https://t.me/s/tecnologia_ofertas',
    'https://t.me/s/gamer_ofertas',
    'https://t.me/s/promosbr',
    'https://t.me/s/achados_do_dia_br',
    'https://t.me/s/promocoes_relampago_br'
];

let autoPromoInterval: NodeJS.Timeout | null = null;
let autoPromoTimeout: NodeJS.Timeout | null = null;
let globalSocket: any = null;
let isChecking = false;

export async function initAutoPromo(socket: any) {
    globalSocket = socket;
    
    if (autoPromoInterval) clearInterval(autoPromoInterval);
    if (autoPromoTimeout) clearTimeout(autoPromoTimeout);

    // Inicia a verificação a cada 5 minutos (300000 ms)
    autoPromoInterval = setInterval(() => checkAndSendPromo(), 300000);
    // Também faz uma busca logo que iniciar
    autoPromoTimeout = setTimeout(() => checkAndSendPromo(), 15000);
}

const decodeHtml = (text: string) => {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(Number(dec)))
        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
};

interface Promo {
    link: string;
    secondaryLink?: string;
    title?: string;
    oldPrice?: string;
    price?: string;
    coupon?: string;
    instructions?: string;
    photoUrl?: string;
    niche?: string;
}

export async function scrapeOffers(): Promise<Promo[]> {
    const promos: Promo[] = [];
    
    for (const channelUrl of TELEGRAM_CHANNELS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(channelUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
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
                
                const nichesConfig: any = {
                    tech: {
                        positive: [
                            'pc', 'computador', 'gamer', 'placa de vídeo', 'placa-mãe', 'placa mãe', 'processador',
                            'ryzen', 'intel', 'core i', 'memória ram', 'ddr4', 'ddr5', 'ssd', 'nvme', 'm.2', 'hd', 'disco rígido',
                            'gabinete', 'fonte', 'water cooler', 'watercooler', 'air cooler', 'rtx', 'gtx', 'rx',
                            'radeon', 'nvidia', 'amd', 'mouse', 'teclado', 'headset', 'monitor', 'cadeira gamer',
                            'joystick', 'gamepad', 'controle', 'nintendo switch', 'playstation', 'xbox',
                            'ps4', 'ps5', 'xbox series', 'notebook', 'laptop', 'macbook', 'setup',
                            'fone de ouvido', 'microfone', 'webcam', 'roteador', 'pendrive', 'micro sd',
                            'celular', 'smartphone', 'iphone', 'galaxy', 'poco', 'xiaomi', 'smart tv', 'tv'
                        ],
                        negative: [
                            'liquidificador', 'fritadeira', 'airfryer', 'fralda', 'sabão', 'sabonete', 'shampoo', 
                            'desodorante', 'cafeteira', 'geladeira', 'fogão', 'microondas', 'micro-ondas', 'aspirador', 
                            'ferro de passar', 'perfume', 'maquiagem', 'creme', 'multiprocessador', 'oster', 'batedeira', 
                            'mixer', 'panela', 'forno', 'gloss', 'batom', 'skincare', 'hidratante', 'cabelo',
                            'ômega', 'omega', 'vitamina', 'suplemento', 'cápsula', 'capsula', 'whey', 'creatina', 'óleo de peixe', 'alimento'
                        ]
                    },
                    casa: {
                        positive: [
                            'liquidificador', 'fritadeira', 'airfryer', 'cafeteira', 'geladeira', 'fogão', 'microondas', 
                            'micro-ondas', 'aspirador', 'ferro de passar', 'multiprocessador', 'oster', 'batedeira', 
                            'mixer', 'panela', 'forno', 'sofá', 'cama', 'lençol', 'travesseiro', 'toalha', 'tapete',
                            'mesa', 'cadeira', 'armário', 'guarda-roupa', 'cozinha', 'eletrodoméstico', 'lavadora'
                        ],
                        negative: [
                            'pc', 'gamer', 'placa de vídeo', 'processador', 'ryzen', 'intel', 'ssd', 'memória ram'
                        ]
                    },
                    masculino: {
                        positive: [
                            'ferramenta', 'parafusadeira', 'furadeira', 'chave de fenda', 'chave philips', 'chave de grifo',
                            'chave allen', 'serra', 'trena', 'esmerilhadeira', 'lixadeira', 'martelete', 'compressor',
                            'macaco hidráulico', 'pneu', 'som automotivo', 'óleo de motor', 'lavadora de alta pressão', 
                            'wap', 'relógio', 'barbeador', 'aparador de pelos', 'canivete', 'lanterna', 'barraca',
                            'multímetro', 'solda', 'furadeira de impacto', 'kit de ferramentas', 'roçadeira', 'soprador'
                        ],
                        negative: [
                            'maquiagem', 'perfume feminino', 'vestido', 'bolsa feminina', 'salto alto', 'feminino'
                        ]
                    },
                    perfumes: {
                        positive: [
                            'perfume', 'fragrância', 'fragrancia', 'eau de parfum', 'eau de toilette', 'edp', 'edt', 
                            'colônia', 'cosmético', 'skincare', 'maquiagem', 'batom', 'gloss', 'sérum', 'serum',
                            'hidratante', 'loção', 'shampoo', 'condicionador', 'protetor solar', 'sabonete',
                            'oboticário', 'boticário', 'natura', 'eudora', 'lattafa', 'afnan', 'armaf', 'dior', 'chanel',
                            'paco rabanne', 'carolina herrera', 'ysl', 'lancôme', 'lancome', 'mac', 'quem disse berenice',
                            'vult', 'niina secrets', 'virginia', 'wepink', 'perfume árabe', 'perfume arabe'
                        ],
                        negative: [
                            'pc', 'hardware', 'placa de vídeo', 'processador', 'tv', 'geladeira', 'fogão', 'pneu', 'absorvente', 'fralda', 'papel higiênico', 'lenço', 'saco', 'lixo'
                        ]
                    },
                    geral: {
                        positive: [
                            'cupom shopee', 'cupom aliexpress', 'cupom ali', 'cupom amazon', 'cupom mercado livre', 
                            'cupom mercadolivre', 'cupom de desconto', 'off em r$', 'off em', 'novo cupom', 'cupom liberado',
                            'desconto no app', 'qualquer produto', 'todo o site', 'toda a loja', 'cupom fiscal',
                            'cupom válido', 'cupom valido'
                        ],
                        negative: []
                    }
                };

                // Identifica a qual nicho essa oferta pertence
                let foundNiche: string | null = null;
                
                for (const [nicheName, rules] of Object.entries(nichesConfig)) {
                    const isPositive = (rules as any).positive.some((keyword: string) => {
                        const kw = keyword.trim();
                        if (['pc', 'hd', 'tv', 'rx', 'gtx', 'rtx', 'iphone', 'macbook', 'ipad', 'ssd', 'cama', 'wap', 'pneu', 'som', 'edp', 'edt', 'mac', 'ysl', 'vult', 'natura', 'mesa', 'serra', 'solda', 'amd'].includes(kw)) {
                            return new RegExp(`\\b${kw}\\b`, 'i').test(lowerHtml);
                        }
                        return lowerHtml.includes(keyword);
                    });
                    
                    const isIgnored = (rules as any).negative.some((keyword: string) => lowerHtml.includes(keyword));
                    
                    if (isPositive && !isIgnored) {
                        foundNiche = nicheName;
                        break;
                    }
                }

                if (!foundNiche) {
                    continue; 
                }

                const hasAmazon = !!process.env.AFFILIATE_TAG;
                const hasShopee = !!process.env.SHOPEE_AFFILIATE_ID;
                const hasAli = !!process.env.ALIEXPRESS_KEY || (!!process.env.ALIEXPRESS_APP_KEY && !!process.env.ALIEXPRESS_APP_SECRET);

                const dynamicAllowedDomains: string[] = [];
                if (hasAmazon) dynamicAllowedDomains.push('amzn.to', 'amazon.com', 'link.amazon', 'amzlinks.in', 'amzn.divulgador.link');
                if (hasShopee) dynamicAllowedDomains.push('shopee.com.br', 'shope.ee', 's.shopee.com.br');
                if (hasAli) dynamicAllowedDomains.push('aliexpress.com', 'ali.ski');
                
                const hasML = !!process.env.ML_COOKIE && !!process.env.ML_CSRF && !!process.env.ML_TAG;
                if (hasML) dynamicAllowedDomains.push('mercadolivre.com.br', 'meli.la');

                if (dynamicAllowedDomains.some(domain => lowerHtml.includes(domain))) {
                    const allUrls = [...msgHtml.matchAll(/href="(https:\/\/[^"]+)"/g)].map(m => m[1]);
                    
                    // Filtra links que são imagens, widgets da amazon ou links de outros grupos
                    const validUrls = allUrls.filter(url => 
                        !url.includes('telegra.ph') && 
                        !url.includes('amazon-adsystem.com') && 
                        !url.includes('t.me') &&
                        dynamicAllowedDomains.some(domain => url.includes(domain))
                    );

                    if (validUrls.length > 0) {
                        let originalLink = validUrls[0];
                        let secondaryLink = validUrls.length > 1 ? validUrls[1] : undefined;

                        if (originalLink.includes('coin-index') && secondaryLink) {
                            const temp = originalLink;
                            originalLink = secondaryLink;
                            secondaryLink = temp;
                        }
                        
                        const decodedMsgHtml = decodeHtml(msgHtml);

                        // Extrai o preço (ex: R$ 1.200,00 ou POR 89,16)
                        const priceMatch = decodedMsgHtml.match(/(?:R\$|Por)\s*([\d\.,]+)/i);
                        const price = priceMatch ? 'R$ ' + priceMatch[1] : undefined;

                        // Pega a linha original que continha o preço (para ver se tinha um "De: " ou "Por: ")
                        let oldPrice;
                        if (price && decodedMsgHtml.match(/De:?\s*(?:R\$)?\s*[\d\.,]+/i)) {
                            const oldPriceMatch = decodedMsgHtml.match(/De:?\s*(?:R\$)?\s*([\d\.,]+)/i);
                            if (oldPriceMatch) {
                                oldPrice = 'De: R$ ' + oldPriceMatch[1];
                            }
                        }

                        // Função para limpar tags HTML
                        const stripHtml = (text: string) => text.replace(/<[^>]*>?/gm, '').trim();

                        // Extrai título (ignora chamadas de clickbait que normalmente estão em TUDO MAIÚSCULO e ignora instruções)
                        let title;
                        const lines = msgHtml.split(/<br\s*\/?>/i);
                        for (let i = 0; i < lines.length; i++) {
                            const cleanLine = decodeHtml(stripHtml(lines[i]));
                            const lowLine = cleanLine.toLowerCase();
                            const isInstruction = ['resgate', 'aplique', 'frete', 'desconto', 'app', 'aplicativo', 'pix', 'parcela', 'carrinho', 'finalizar', 'compre', 'clique', 'link'].some(ik => lowLine.includes(ik));
                            
                            if (cleanLine.length > 5 && cleanLine !== cleanLine.toUpperCase() && !cleanLine.includes('R$') && !cleanLine.includes('http') && !isInstruction) {
                                title = cleanLine;
                                break;
                            }
                        }
                        if (!title && lines.length > 0) {
                            title = decodeHtml(stripHtml(lines[0]));
                        }

                        // Extrai cupom
                        let coupon;
                        for (const line of lines) {
                            const cleanLine = stripHtml(decodeHtml(line));
                            const match = cleanLine.match(/cupom(?:[ \t]+de(?:[ \t]+desconto)?)?[ \t]*:?[ \t]*([A-Za-z0-9]+)/i);
                            if (match) {
                                const extracted = match[1];
                                const invalidWords = ['de', 'desconto', 'valido', 'válido', 'para', 'na', 'no', 'o', 'a', 'e', 'aqui', 'pelo', 'clicando', 'link', 'abaixo', 'agora', 'site', 'app', 'aplicativo', 'frete', 'grátis', 'gratis', 'especial'];
                                if (!invalidWords.includes(extracted.toLowerCase())) {
                                    coupon = extracted;
                                    break;
                                }
                            }
                        }

                        // Extrai as instruções de compra (Filtro para ignorar ad de outros canais)
                        let instructions;
                        const adKeywords = ['t.me', 'grupo', 'nerdofertas', 'ofertas', 'inscreva', 'link'];
                        const instructionKeywords = ['resgate', 'aplique', 'cupom', 'frete', 'desconto', 'app', 'aplicativo', 'pix', 'parcela', 'carrinho', 'finalizar', 'moeda'];
                        const ignoreKeywords = ['obg', 'obrigado', 'valeu', 'crédito', 'credito', 'botdoafiliado'];
                        
                        if (lines.length > 1) {
                            for (let j = 1; j < lines.length; j++) {
                                // Limpa tags HTML da linha para não vazar código de emoji
                                const cleanLine = stripHtml(decodeHtml(lines[j]));
                                if (!cleanLine) continue;

                                const lowLine = cleanLine.toLowerCase();
                                const isAd = adKeywords.some(ad => lowLine.includes(ad));
                                const shouldIgnore = ignoreKeywords.some(ig => lowLine.includes(ig));
                                const hasInstructionKeyword = instructionKeywords.some(ik => lowLine.includes(ik));
                                
                                // Não pega linhas que tenham preço, link, cupom ou propagandas
                                if (!lowLine.includes('r$') && !lowLine.includes('http') && !lowLine.includes('cupom') && !isAd && !shouldIgnore && !lowLine.match(/shope\.ee|shopee\.com|amzn\.to|amazon\.com|link\.amazon|aliexpress\.com|ali\.ski|meli\.la|mercadolivre\.com\.br/)) {
                                    // Pega a linha apenas se tiver palavras-chave de instrução ou se for curta o suficiente para ser um passo, mas grande o bastante pra ter sentido
                                    if (cleanLine.length > 5 && (hasInstructionKeyword || cleanLine.length < 100)) {
                                        instructions = cleanLine;
                                        break;
                                    }
                                }
                            }
                        }

                        promos.push({ link: originalLink, secondaryLink, title, oldPrice, price, coupon, instructions, photoUrl, niche: foundNiche });
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || (error.message && error.message.includes('fetch failed'))) {
                console.log(`⚠️ [AutoPromo] Timeout/Falha de rede ao buscar ${channelUrl}, ignorando...`);
            } else {
                console.error(`Erro ao buscar ofertas de ${channelUrl}:`, error);
            }
        }
    }
    
    return promos;
}

// Helper para atraso
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function checkAndSendPromo() {
    if (isChecking) {
        console.log('⏳ [AutoPromo] Verificação já em andamento, ignorando nova chamada para evitar duplicidade...');
        return;
    }
    isChecking = true;

    try {
        const socket = globalSocket;
        if (!socket) return;

        const activeGroups = await getActiveGroups();
        if (activeGroups.length === 0) return;

        const activeNiches = [...new Set(activeGroups.map(g => g.niche))].join(', ');
        console.log(`🔄 [AutoPromo] Buscando novas ofertas para os nichos ativos: [${activeNiches}]...`);
        
        const promos = await scrapeOffers();
        if (promos.length === 0) return;

        const db = await getDb();

        const sentCounts: Record<string, { amazon: number, ali: number, shopee: number }> = {};

        // Processa todas as promoções encontradas (da mais antiga para a mais nova)
        for (const promo of promos.reverse()) {
            const niche = promo.niche || 'geral';
            if (!sentCounts[niche]) {
                sentCounts[niche] = { amazon: 0, ali: 0, shopee: 0 };
            }

            const isAmazon = promo.link.includes('amazon') || promo.link.includes('amzn.to');
            const isAli = promo.link.includes('aliexpress') || promo.link.includes('ali.ski');
            const isShopee = promo.link.includes('shopee') || promo.link.includes('shope.ee');

            if (isAmazon && sentCounts[niche].amazon >= 5) continue;
            if (isAli && sentCounts[niche].ali >= 5) continue;
            if (isShopee && sentCounts[niche].shopee >= 5) continue;

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

                console.log(`🚀 [AutoPromo] Disparando nova oferta [Nicho: ${promo.niche || 'geral'}]: ${promo.title || 'Oferta'}`);
                
                for (const group of activeGroups) {
                    if (group.niche !== 'geral' && promo.niche !== 'geral' && group.niche !== promo.niche) {
                        continue;
                    }
                    
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            // Sempre usar o globalSocket mais recente, caso a conexão tenha caído e reconectado durante o loop
                            const currentSocket = globalSocket;
                            if (!currentSocket) throw new Error('Socket indisponível (desconectado)');

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

                                try {
                                    await currentSocket.sendMessage(group.id, { image: imagePayload, caption: message });
                                } catch (mediaErr: any) {
                                    if (mediaErr?.output?.statusCode === 428 || mediaErr?.message?.includes('Closed')) {
                                        console.log(`⚠️ Falha de mídia (428) no grupo ${group.id}. Tentando fallback sem imagem...`);
                                        await currentSocket.sendMessage(group.id, { text: message });
                                    } else {
                                        throw mediaErr;
                                    }
                                }
                            } else {
                                await currentSocket.sendMessage(group.id, { text: message });
                            }
                            
                            // Pequeno delay entre o envio para grupos diferentes
                            await delay(1500);
                            break; // Sucesso, sai do loop de tentativas
                        } catch (err: any) {
                            console.error(`Erro ao enviar para o grupo ${group.id}:`, err);
                            retries--;
                            if (retries === 0) {
                                console.error(`Falha final ao enviar para o grupo ${group.id} após tentativas.`);
                            } else {
                                console.log(`Tentando novamente em 3 segundos... (${retries} tentativas restantes)`);
                                await delay(3000);
                            }
                        }
                    }
                }

                // Salva no banco que enviamos
                try {
                    await db.run('INSERT INTO sent_promos (link) VALUES (?)', [promo.link]);
                    
                    if (isAmazon) sentCounts[niche].amazon++;
                    if (isAli) sentCounts[niche].ali++;
                    if (isShopee) sentCounts[niche].shopee++;

                    // Delay de 10s entre ofertas enviadas para não tomar ban do WhatsApp
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
    } finally {
        isChecking = false;
    }
}
