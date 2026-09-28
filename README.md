# Flora Catalana 🌿

App d'aprenentatge per identificar la flora autòctona i exòtica catalana a partir de fotografies.

## Com jugar

Obre `index.html` a un navegador (no cal cap instal·lació ni servidor).

- **Origen de les espècies**: tria si vols practicar amb les 83 espècies autòctones, les 23 exòtiques
  (invasores o no invasores) o totes 106 juntes. Les exòtiques es marquen amb una etiqueta
  🚨 *Invasora* o 🌍 *Exòtica*.
- **Tipus de test**: nom en català, nom científic, o tots dos alhora.
- **Repte ràpid**: preguntes a l'atzar sense repetir; tria'n 10, 20, 40 o totes les del catàleg seleccionat.
- **Repàs intel·ligent**: prioritza les espècies que encara no coneixes o que has fallat més.
- **Veure totes les fotos**: cada espècie té diverses fotografies (fulla, flor, fruit, escorça...);
  des de la pregunta, el feedback o les fitxes pots obrir un carrusel amb totes per comparar detalls.
- **Fitxes**: consulta totes les espècies amb foto, nom científic i descripció.
- **Progrés**: veu el teu percentatge d'encert, millor ratxa i les plantes que et costen més.

El progrés es desa al navegador (localStorage), no cal compte ni connexió a internet un cop carregada la pàgina.

## Dades

Les 106 espècies (nom, nom científic, descripció, origen i totes les seves fotografies) provenen
de dos documents de la Generalitat de Catalunya (Institut de Seguretat Pública de Catalunya,
Nil Escolà Lamora):

- *"Visum de flora - Espècies autòctones"* — 83 espècies.
- *"Visum de flora - Espècies exòtiques"* — 23 espècies (10 no invasores + 13 invasores CEEEI).

## Estructura

- `index.html`, `style.css`, `app.js` — aplicació (sense dependències ni build).
- `species_data.js` — dades de les espècies incrustades com a JS.
- `assets/img/` — fotografies de les espècies autòctones.
- `assets/img_exotiques/` — fotografies de les espècies exòtiques.
- `assets/species.json` — mateixes dades en format JSON (font per regenerar `species_data.js`).
