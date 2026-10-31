// Små, snille vitser som legges til sist i SMS-en om et avvik, så det ikke blir vondt å få en.
// Legg gjerne til flere; én velges tilfeldig per avvik.
export const VITSER = [
  'Hva sier en hund når den får strømstøt? – Vov, vov, vov!',
  'Hvorfor gikk tomaten over veien? – Den ville komme til ketsjupen.',
  'Hva heter verdens tryggeste fisk? – Hjelmtorsk.',
  'Hvorfor er ikke fjell redde? – De har tatt mot til seg.',
  'Hva er det som går og går, men aldri kommer til døra? – Klokka.',
  'Hvorfor tok eggene toget? – Fordi de ikke kunne kjøre.',
  'Hva sa den ene veggen til den andre? – Vi møtes i hjørnet.',
  'Hvorfor har elefanten røde tær? – For å gjemme seg i kirsebærtreet. Har du sett en der? Nei, så det virker!',
  'Hva heter Norges fineste by? – Søtesund.',
  'Hvorfor fikk sauen sparken? – Den sa bare «bæ» til sjefen.',
  'Hva gjør en snømann som er ferdig på jobb? – Han smelter inn i mengden.',
  'Hvorfor er støvsugere så gode venner? – De suger alltid etter selskap.',
  'Hva er grønt og hopper rundt i hagen? – En froskehopp.',
  'Hvorfor er bøker så flinke til å holde på hemmeligheter? – De lukker seg når de er ferdig.',
  'Hva sier en kattunge på julaften? – Mjau-l!',
  'Hvorfor tok laksen lærerutdanning? – Den ville bli en skolefisk.',
  'Hva heter en ku som ligger på bakken? – Bakkenbiff.',
  'Hvorfor er musa redd for datamaskinen? – Den har hørt om katten på tastaturet.',
  'Hva sa trappa til døra? – Du åpner deg for lite.',
  'Hvorfor klatrer ikke kuer i trær? – De har ikke hodet for høyder.',
  'Hva er det beste med Sveits? – Vet ikke, men flagget er et stort pluss.',
  'Hvorfor var besenet så glad? – Det hadde fått et nytt feiende skaft.',
  'Hva heter en sjokolade som alltid sier ja? – Jasjokolade.',
  'Hvorfor liker ikke skjeletter å bo i hus? – De har ikke mage til det.',
  'Hva sier man til en søppelbøtte som er trist? – Det ordner seg, du blir tømt snart.',
  'Hvorfor gikk lyspæra til legen? – Den følte seg litt utbrent.',
  'Hva heter en spøkelsesvaskemaskin? – Vaske-buuu.',
  'Hvorfor er oppvaskmaskinen så rolig? – Den tar alt med et skum.',
  'Hva sa sokken til vaskemaskinen? – Finner du ikke makkeren min, blir jeg helt alene.',
  'Hvorfor står lyset alltid på i kjelleren? – Det er redd for mørket.'
];
/** Én tilfeldig vits; `random` kan byttes ut i tester. */
export const tilfeldigVits = (random = Math.random) => VITSER[Math.min(VITSER.length - 1, Math.floor(random() * VITSER.length))];
