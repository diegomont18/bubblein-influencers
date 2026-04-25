Sim, dá pra fazer monitoramento de marca via Apify tranquilamente — é exatamente um dos casos de uso desses actors. Resumo direto:
Actors que servem pro que você quer

apimaestro/linkedin-posts-search-scraper-no-cookies — busca por keyword sem precisar de login/cookies. Ordena por relevance ou date_posted e permite filtrar por empresas específicas (via URN da empresa). Bom custo-benefício.
harvestapi/linkedin-post-search — US$ 2 por 1k posts, aceita queries com operadores booleanos do LinkedIn (limite de 85 caracteres por query). Bom pra buscas mais sofisticadas tipo "BubbleIn" OR "bubble in".
curious_coder/linkedin-post-search-scraper — aceita searchUrl direto do LinkedIn, então você consegue passar todos os filtros avançados nativos (data, indústria, empresa, idioma etc.) montando a URL de busca e colando no actor.

Sobre o filtro de período (tua pergunta central)
Os actors não costumam ter um campo "de data X até data Y" explícito. O que funciona na prática:

Ordenar por date_posted e limitar a quantidade de posts — suficiente pra janelas curtas (últimos dias).
Passar um searchUrl do LinkedIn com o filtro nativo datePosted=past-24h, past-week ou past-month. É o mais usado pra monitoramento recorrente.
Rodar o scraper com scheduler (diário ou semanal) e armazenar os posts por postedAt no teu banco — aí você tem histórico completo e faz o recorte por período no teu lado. Essa é a abordagem certa pra um produto, não fazer query ad-hoc toda vez.

Pro caso do BubbleIn especificamente
Três coisas pra pensar antes de meter isso no roadmap:

Isso resolve monitoramento de marca (quem falou sobre X marca/keyword), mas também pode alimentar o Score de Relevância B2B — posts de creator + engajamento por decision-maker = sinal forte de qualidade.
A sensibilidade legal do acesso a dados do LinkedIn que você já tinha mapeado continua valendo aqui. Esses actors são terceiros e explicitamente dizem que não são afiliados ao LinkedIn — tecnicamente é scraping e viola os ToS do LinkedIn. Pra POC / validação interna, tranquilo. Pra virar feature vendida a cliente, precisa de uma resposta jurídica antes.
Como fallback mais "seguro" dá pra olhar a LinkedIn Marketing Developer Platform (API oficial) pra brand monitoring, mas o acesso é restrito a partners aprovados e o escopo é bem mais limitado que Apify.