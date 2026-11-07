# Owned Map: plan de palabras clave para USA (noviembre 2026)

Objetivo: clics con intención de compra desde EEUU (después UK, Canadá y Australia), sin que dos páginas compitan por la misma búsqueda.

---

## 0. Lo que este documento NO tiene (léelo primero)

**No tengo volúmenes de búsqueda mensuales.** Ahrefs, Semrush y Google Keyword Planner no son accesibles desde aquí (probé Ahrefs y Semrush: piden login y no muestran datos). Cualquier cifra de "búsquedas al mes" que te diera sería inventada, así que no hay ninguna.

Lo que sí tengo, y con lo que está hecho el análisis:

1. **Los resultados reales de Google (EEUU) de 20 búsquedas**: quién ocupa cada resultado y de qué tipo (medios con autoridad, listados de apps, páginas de empresas, spam).
2. **Estimaciones de tráfico de Similarweb** de los competidores (septiembre 2026, a nivel mundial, dominadas por búsquedas de marca):
   - Stessa: 353,7 mil visitas en 3 meses. Kubera: 126,2 mil. Landlord Studio: 64,9 mil. (monarchmoney.com: 23,2 mil, pero su dominio principal es monarch.com, así que no es comparable.)
   - Lo que más les trae son búsquedas de marca ("stessa login", "kubera app"). Pero Landlord Studio también aparece con búsquedas sin marca ("how to increase rent on rental property", "landlord expenses and receipts template"), lo que confirma que el contenido útil les trae clientes.
3. **Mi criterio de intención de compra** (1 a 5): cuánta probabilidad hay de que quien hace esa búsqueda sea cliente de Owned Map. Es un juicio mío, no un dato.

**Cómo cerrar el hueco de volúmenes en 30 minutos:** sección 8, con un CSV listo (`marketing/keywords-to-validate.csv`). Con esos números recalculo las prioridades.

---

## 1. Conclusión

1. **Las búsquedas generales ("best net worth tracker") están dominadas por medios con mucha autoridad** (BiggerPockets, Money.ca, Moneywise, Origin...). Con un dominio nuevo no se gana ahí en los primeros meses. No gastes la primera ola en ellas.
2. **Hay huecos reales en búsquedas más específicas**, donde los resultados son listados de apps, blogs flojos o páginas duplicadas de directorios: *rental property portfolio tracker*, *net worth tracker without linking bank accounts*, *estate asset inventory template*, y las páginas de barco, coche de colección y avión.
3. **El mejor cliente de Owned Map** es quien tiene varias cosas valiosas (propiedades, barco, coches, terreno), a veces con socios, y no quiere conectar el banco. Las palabras clave deben apuntar a esa persona, no a "free net worth tracker" (atrae a quien busca algo gratis, y Empower gana ahí siempre).
4. **Primera ola recomendada: 6 páginas** (secc. 6). Todas con una frase propia y ningún solape (el test lo exige).

---

## 2. Qué me enseñaron los resultados de Google (EEUU)

| Búsqueda | Qué ocupa los resultados | Lectura |
|---|---|---|
| best net worth tracker | BiggerPockets, Money.ca, Moneywise, Origin, MSPoweruser y varios sitios de baja calidad | **Muy difícil.** Medios establecidos y listados con afiliados |
| net worth tracker for real estate investors app | Un artículo de BiggerPockets, fichas de apps (App Store), anuncios de Etsy, blogs de empresas | **Media.** Pocas páginas dedicadas de verdad |
| rental property portfolio tracker | Un hilo de BiggerPockets, fichas de GetApp y Capterra (repetidas por país), una plantilla de Taskade, una app de Microsoft Store | **Baja a media.** No hay ninguna página de producto fuerte. Hueco claro |
| real estate portfolio tracking software | Stessa, Veld, BuyHoldTrack, Galleon, Reedy, GetApp | **Media.** Páginas de empresa y de comparación |
| personal asset tracker app | Casi todo fichas de App Store y plantillas | **Baja, pero intención dudosa**: muchos no son compradores |
| home inventory app for insurance | NerdWallet, Fox Business, NAIC, Encircle, HomeZada | **Alta y de otra intención** (inventario del hogar para el seguro). No es nuestro producto |
| asset inventory template estate planning | PDF y páginas espejo de baja calidad, FreeWill, EstateExec | **Baja.** Hueco para una página buena con plantilla |
| net worth tracker without linking bank accounts | Fichas de apps, blogs en `pages.dev`, Kubera, Gerald | **Baja.** Y la intención encaja con "no conecto mi banco" |
| kubera alternative | Mezzi, AllInvestView, Toolradar, Fitgap, Product Hunt, Appvizer, x1wealth | **Media.** Agregadores y páginas de empresas. Una comparación seria y con fuentes puede entrar |
| stessa alternative for landlords | Landlord Studio, VerticalRent, Capterra, GetApp, TurboTenant, Ark7 | **Media a alta.** Muchas páginas de empresas con mucha autoridad |
| boat ownership tracker app | Fichas de apps (BoatPassport, Skipper'n, Boat Manager, Tracket, YachtWave) y revistas | **Baja.** Audiencia pequeña pero cliente de mucho valor |
| classic cars collection tracker | Fichas de apps (CarClimb, LastDrive, Custodian, MCCL) | **Baja** |
| how to track all assets for estate planning | Trust & Will, EstateExec, PortfolioPilot, Beneficiary Plan | **Media.** Herramientas de herencia, enfoque distinto |
| landlord software small landlords | TurboTenant, Landlord Studio, Hemlane, Re-Leased, Rentec, TenantCloud, iPropertyManagement | **Muy alta y de otra intención** (gestión de alquileres). No atacar |

Importante: la lista de resultados de la herramienta de búsqueda es aproximada y no garantiza el orden real. Úsala para ver **qué tipo de páginas** compiten, no para ver posiciones exactas.

---

## 3. Mapa de palabras clave, con intención y competencia

Intención: 1 = quiere aprender, 5 = está a punto de elegir una herramienta como la nuestra. **Volumen: por validar** (sección 8).

### Ola 1: más cerca de la compra y con resultados débiles

| Palabra principal (una por URL) | Otras formulaciones, en la MISMA página | Página | Etapa | Intención | Competencia observada |
|---|---|---|---|---|---|
| **rental property portfolio tracker** | real estate portfolio tracker · real estate portfolio tracking software · rental portfolio tracker | `/solutions/rental-property-portfolio-tracker` | BOFU | **5** | Baja a media |
| **net worth tracker without linking bank accounts** | manual net worth tracker · net worth tracker no bank connection · private net worth tracker | `/solutions/net-worth-tracker-without-bank-linking` | BOFU | **5** | Baja |
| **best net worth tracker for real estate** | best app to track rental properties | `/compare/best-net-worth-trackers-for-real-assets` | MOFU | 4 | Media |
| **landlord studio vs owned map** | landlord studio alternative | `/compare/landlord-studio-vs-owned-map` | BOFU | 4 | Media |
| **baselane vs owned map** | baselane alternative | `/compare/baselane-vs-owned-map` | BOFU | 4 | Media |
| **estate asset inventory template** | asset inventory for estate planning · list of assets for executor | `/guides/estate-asset-inventory-template` | MOFU | 3 | Baja |

### Ya publicadas (comparaciones)

kubera vs owned map (+ kubera alternative, kubera competitors) · monarch money vs owned map · empower vs owned map · stessa vs owned map. Cada una con 2.700 a 3.200 palabras y fuentes.

### Ola 2: audiencias estrechas, cliente de mucho valor

| Palabra principal | Otras formulaciones | Página | Intención | Competencia observada |
|---|---|---|---|---|
| **boat ownership tracker app** | boat maintenance and documents tracker · track boat expenses and registration | `/solutions/boat-ownership-tracker` | 5 | Baja |
| **classic car collection tracker** | car collection value tracker · track collector car documents | `/solutions/classic-car-collection-tracker` | 5 | Baja |
| **aircraft ownership tracker** | aircraft records and inspection tracker | `/solutions/aircraft-ownership-tracker` | 5 | Por comprobar (no la busqué) |
| **asset tracking spreadsheet vs owned map** | asset tracking spreadsheet alternative · excel template for tracking assets | `/compare/spreadsheet-vs-owned-map` | 4 | Baja a media |

### Ola 3: solo si Search Console demuestra que traen clics

yield on cost vs cap rate · boat ownership costs per year · personal net worth statement template · copilot money vs owned map (hay que verificar sus datos antes).

### La portada

`/` conserva "track every asset you own" más "asset tracker", "personal asset tracker", "asset tracking app" y "real asset tracker". **Ninguna otra página puede usar esas frases en título, H1 o descripción.**

---

## 4. Lo que NO hay que atacar (y por qué)

1. **"asset tracking software"** a secas: lo dominan herramientas de **empresas** (equipos, IT, inventario fijo). Atrae el clic equivocado. (Esto es conocimiento general mío: no lo verifiqué con una búsqueda.)
2. **"home inventory app"**: es el inventario de muebles para el seguro del hogar, con NerdWallet, Fox Business y la NAIC encima. Es otro producto.
3. **"free net worth tracker"**: Empower gana siempre. Atrae a quien no quiere pagar $47.
4. **"landlord software / property management software"**: es gestión de inquilinos y cobros. Muy competido y no somos eso.
5. **"best net worth tracker"** como primera apuesta: medios con años de autoridad. Se intenta después, cuando haya enlaces.
6. **Cualquier segunda página para algo que ya cubre otra** ("kubera pricing", "kubera review", "is kubera worth it", "stessa competitors"). Van en la misma página como secciones o preguntas.

---

## 5. La regla anti-canibalización, aplicada

Ya está en `content/seo-map.mjs` y la comprueba `test/seo-map.test.js` en cada build. Las 7 reglas:

1. Cada URL tiene **una** frase principal, y ninguna otra la usa en título, H1 ni descripción.
2. Una frase pertenece a una sola URL, entre las publicadas y las planeadas.
3. **Una página por competidor.** "X alternative" y "X vs Owned Map" son la misma búsqueda y se responden en esa página.
4. El índice `/compare/` solo apunta a "net worth tracker comparison"; la portada, a la frase de producto; las páginas legales, a nada.
5. Título, H1 y descripción únicos; la frase en el título, el H1 y las primeras 100 palabras.
6. URLs retiradas: redirección 308 a la página que hereda la búsqueda. Canonical a sí misma.
7. Los enlaces internos describen el destino y nunca usan la frase de otra URL.

**Decisiones de fusión que tomé a propósito** (para evitar canibalizar):

- *rental property portfolio tracker* y *real estate portfolio tracker* son **una sola página**. Google las trata como la misma búsqueda.
- *Personal asset tracker* no tiene página propia: se queda en la portada junto a "asset tracker".
- *Best app to track rental properties* se queda dentro del listado "best net worth tracker for real estate". No hay una segunda página de listado.

**Riesgo conocido, medio:** la página de solución del portfolio de alquileres y el listado de "best net worth tracker for real estate" se parecen en tema. Se diferencian por intención (una vende el producto, la otra compara varias herramientas). Si Search Console muestra que las dos salen para las mismas consultas, unimos las dos.

---

## 6. Qué escribir en cada página (orden de trabajo)

Cada página de **solución** lleva: H1 con la frase principal; en 3 líneas, qué resuelve; capturas del producto con datos de ejemplo; la lista de lo que Owned Map hace y **de lo que no hace** (sin conexión bancaria); un ejemplo con cifras que cuadren; comparación breve con la alternativa que la persona usa hoy (una hoja de cálculo); precio visible y CTA fijo a `/#pricing`; FAQ con datos estructurados; fuentes citadas cuando haya cifras externas.

1. **`/solutions/rental-property-portfolio-tracker`**. El corazón comercial. Mensaje: "todas tus propiedades, con rendimiento, flujo de caja y deuda, en un mapa, sin conectar el banco". Ejemplo: 4 propiedades, una compartida.
2. **`/solutions/net-worth-tracker-without-bank-linking`**. Para quien no quiere dar acceso al banco. Argumento de seguridad honesto: no hay credenciales que proteger.
3. **`/compare/best-net-worth-trackers-for-real-assets`**. Comparativa de 6 a 8 herramientas, con una tabla de a quién conviene cada una (incluida Owned Map, sin esconder sus límites). Esta página atrae enlaces de quien lista herramientas.
4. **`/compare/landlord-studio-vs-owned-map`** y 5. **`/compare/baselane-vs-owned-map`**. Hay que verificar sus datos oficiales antes de escribir, como se hizo con Stessa.
6. **`/guides/estate-asset-inventory-template`**. Con la plantilla CSV como descarga (ya existe) y un ejemplo de inventario relleno. Es la mejor página de enlaces entrantes, porque los resultados de hoy son de baja calidad.

---

## 7. Estrategia por país

- **USA primero.** Todo en inglés americano (`en-US`), dólares, formularios y normas de EEUU (IRS, Schedule E). Las páginas actuales ya lo hacen.
- **UK, Canadá y Australia después**, no ahora: otras formas de escribir ("flat", "landlord" en UK, "investment property" en Australia), otra moneda y otros impuestos. Traducir sin adaptar crea contenido duplicado. Cuando llegue el momento: URLs por país (`/uk/...`), `hreflang`, y frases propias en el mapa.

---

## 8. Validar volúmenes en 30 minutos (gratis)

1. Crea una cuenta de **Google Ads** (no hace falta gastar nada) y abre **Planificador de palabras clave → Obtener volúmenes de búsqueda**.
2. Pega las palabras de `marketing/keywords-to-validate.csv`, ubicación **Estados Unidos**, idioma inglés.
3. Anota la columna de búsquedas mensuales medias, el rango de puja alta (CPC) y la competencia. Sin una campaña activa Google da rangos (por ejemplo, "100 a 1 mil"), y sirve igual para ordenar.
4. Pásame el CSV relleno y recalculo la prioridad con **volumen × intención × facilidad**.
5. Desde el día 14 en adelante, **Search Console** da las consultas reales que ya traen impresiones: es el dato mejor.

Un **CPC alto** indica que hay anunciantes dispuestos a pagar por ese clic, y es la mejor señal de intención de compra que da el Planificador.

---

## 9. Qué esperar

- **No hay cifra de tráfico que pueda prometer.** Un dominio nuevo, sin enlaces, suele tardar meses en mover posiciones.
- Las páginas de comparación y de solución pueden traer los primeros clics cuando Google las indexe (días a semanas) y se posicionen en las búsquedas de baja competencia. Las búsquedas amplias llegarán más tarde, cuando haya enlaces.
- Los primeros clientes seguirán viniendo, sobre todo, del contacto directo. El SEO suma a partir del mes 3 a 9.
- Tu mejor palanca para acelerarlo es **conseguir enlaces**: directorios (Twelve Tools ya está), una mención en el listado de otros, y la plantilla de inventario como gancho.

---

## 10. Actualización (5 nov 2026): lista de palabras con intención de compra y poca competencia

**¿Páginas VS o palabras clave?** Son lo mismo. Una página VS es una palabra clave de tipo "X alternative". La diferencia es de qué tipo de persona la busca:

- **"X vs Owned Map" no tiene búsquedas** (nadie conoce aún la marca). Esas páginas rankean por la variante **"X alternative"** (que va en la misma URL). Solo valen la pena donde alguien busca de verdad esa alternativa: Kubera, Stessa, Landlord Studio y Baselane sí; Copilot, no hasta verificar.
- **Las páginas de solución** ("rental property portfolio tracker") capturan a quien busca **la categoría**, no una marca. Son las de más intención y menos competencia: van **antes** que más páginas VS.

Orden: 1) las 2 de solución de la ola 1; 2) las comparaciones de Landlord Studio y Baselane; 3) el listado y la plantilla de herencia.

### Lista (competencia observada en los resultados reales; volumen por validar)

| # | Palabra clave | Página | Intención | Competencia | Encaje con el producto |
|---|---|---|---|---|---|
| 1 | rental property portfolio tracker (+ real estate portfolio tracker, rental portfolio tracker) | solución | 5 | Baja a media | Alto |
| 2 | rental property equity tracker (+ track equity across rental properties) | **misma página que 1** | 5 | Baja a media | Alto |
| 3 | net worth tracker without linking bank accounts (+ manual / private net worth tracker) | solución | 5 | Baja | Alto |
| 4 | stessa alternative | publicada | 4 | Media a alta | Alto |
| 5 | kubera alternative | publicada | 5 | Media | Alto |
| 6 | landlord studio alternative | VS por hacer | 4 | Media | Medio |
| 7 | baselane alternative | VS por hacer | 4 | Media | Medio |
| 8 | co-owned property tracker (+ shared property ownership tracker) | solución | 4 | **Baja** | Parcial: llevamos la parte de cada socio, no el libro de aportaciones |
| 9 | best net worth tracker for real estate (+ best app to track rental properties) | listado | 4 | Media | Alto |
| 10 | estate asset inventory template (+ list of assets for executor) | guía + CSV | 3 | Baja | Alto |
| 11 | app to manage property and vehicle records (+ organize family asset documents) | solución | 3 | Baja a media (Quicken ya publica aquí) | Alto |
| 12 | boat ownership tracker app (+ track boat expenses and registration) | solución | 4 | Baja | Parcial: no somos un diario de mantenimiento de motor |
| 13 | classic car collection tracker (+ car collection value tracker) | solución | 5 | Baja | Alto |
| 14 | asset tracking spreadsheet alternative (+ excel template for tracking assets) | VS | 4 | Baja a media | Alto |
| 15 | track real estate in multiple countries | solución | 4 | Baja a media | **Comprobar primero** si la app soporta varias monedas |
| 16 | insurance renewal tracker for rental properties | solución | 3 | Baja a media | Parcial: guardamos las fechas, no gestionamos pólizas |

### Lo que descarté tras esta segunda ronda

- **aircraft ownership tracker**: los resultados los ocupan apps de bitácora y mantenimiento (HobbsMate, Coflyt, FlightBoss y otras). Owned Map no es una bitácora. Pasa a ola 3 y solo con el ángulo de coste, valor y documentos.
- **short term rental portfolio tracker**: lo ocupan hojas de cálculo y herramientas de analítica de reservas (ocupación, tarifa diaria). Nosotros no hacemos eso.
- **Cualquier "property management software"**: otro producto.

### Honestidad sobre el encaje

Las filas 8, 12, 15 y 16 tienen encaje parcial. La competencia es baja, pero si la página promete algo que el producto no hace (un libro de aportaciones entre socios, un diario de motor, monedas múltiples), traerá clics que no convierten. **Cada una de esas páginas dirá con claridad qué hace Owned Map y qué no.**

## 11. Segunda ronda (7 nov 2026): más palabras con compra y poca competencia

No tengo volúmenes reales; la competencia sale de leer los resultados de Google de EEUU. Pasa `keywords-to-validate.csv` por Keyword Planner antes de escribir.

| Prioridad | Página nueva (wave 4) | Palabra principal | Por qué |
|---|---|---|---|
| 1 | /guides/schedule-of-real-estate-owned-template | schedule of real estate owned template | Inversores que piden un préstamo y deben listar sus propiedades. Los resultados son plantillas de StackSource, PropertyMetrics, OfferMarket y PDFs de bancos. Un export SREO gratis desde Owned Map es el gancho de enlaces. |
| 2 | /compare/projectionlab-vs-owned-map | projectionlab vs owned map | Su plan gratis no enlaza cuentas: compite con nuestro pilar sin bancos. |
| 3 | /compare/quicken-simplifi-vs-owned-map | quicken simplifi vs owned map | Simplifi exige añadir inmuebles a mano; hay mucho tráfico de comparativas. |
| 4 | /solutions/luxury-asset-portfolio-tracker | luxury asset portfolio tracker | No encontré un rival de precio consumidor: solo software de family office para empresas y Aleta/EstateSpace. Encaje parcial: no hay cuentas de inversión. |
| 5 | /guides/rental-portfolio-ltv-calculator | rental portfolio ltv calculator | Hay herramientas pequeñas (Landager, DoorVault). Una calculadora gratis atrae enlaces y lleva al pilar de alquileres. |

Descartadas: "mint alternative…" (Mint cerró en marzo 2024, la demanda baja y Kubera ya tiene blog), "free net worth tracker for rental properties" (quien busca gratis no paga; Richify y PortfolioPilot lo dan gratis) y "when to sell a rental property" (Investopedia y BiggerPockets mandan; solo si Search Console lo pide).

Dato útil: en BiggerPockets un inversor dice que solo una hoja de cálculo le manejaba los porcentajes de propiedad. Respalda la página de copropiedad ya planificada.

Aviso: una fuente pone Kubera personal en $150/año y otras en $250/año. Confirma el precio en su web antes de citarlo en el listado.
