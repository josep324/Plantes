# Flora Autòctona 🌿

App d'aprenentatge per identificar la flora autòctona catalana a partir de fotografies.

## Com jugar

Obre `index.html` a un navegador (no cal cap instal·lació ni servidor).

- **Repte ràpid**: 10 preguntes a l'atzar amb 4 opcions de resposta.
- **Repàs intel·ligent**: prioritza les espècies que encara no coneixes o que has fallat més.
- **Fitxes**: consulta totes les espècies amb foto, nom científic i descripció.
- **Progrés**: veu el teu percentatge d'encert, millor ratxa i les plantes que et costen més.

El progrés es desa al navegador (localStorage), no cal compte ni connexió a internet un cop carregada la pàgina.

## Dades

Les 83 espècies (nom, nom científic, descripció i fotografia) provenen del document
*"Visum de flora - Espècies autòctones"* (Generalitat de Catalunya, Institut de
Seguretat Pública de Catalunya).

## Estructura

- `index.html`, `style.css`, `app.js` — aplicació (sense dependències ni build).
- `species_data.js` — dades de les espècies incrustades com a JS.
- `assets/img/` — fotografies de cada espècie.
- `assets/species.json` — mateixes dades en format JSON (font per regenerar `species_data.js`).
