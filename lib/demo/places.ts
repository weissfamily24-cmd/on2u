// DEMO-DATEN. Nur für Prototyp und Tests. Nie in Produktion.
import type { Place } from '@/lib/data/types';

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const demoPlaces: Place[] = [
  { id: 'p1', name: 'Zur alten Fähre', category: 'Fränkisch', lat: 49.8925, lng: 10.8858, address: 'Kapuzinerstraße 12',
    rating: 4.6, distanceLabel: '400 m', caption: 'Heute Schäufele mit Kloß, solange es reicht.',
    menu: [
      { id: 'm1', name: 'Schäufele mit Kloß', description: 'Kruste, Biersoße', priceCents: 1490, currency: 'EUR' },
      { id: 'm2', name: 'Rauchbier 0,5 l', description: 'vom Fass', priceCents: 390, currency: 'EUR' },
      { id: 'm3', name: 'Bratwurst, 3 Stück', description: 'mit Kraut', priceCents: 950, currency: 'EUR' },
    ],
    confirmations: [
      { id: 'c1', placeId: 'p1', by: 'owner', pricesMatch: true, createdAt: ago(2) },
      { id: 'c2', placeId: 'p1', by: 'guest', visitId: 'v1', pricesMatch: true, createdAt: ago(3) },
    ] },
  { id: 'p2', name: 'Café Obstmarkt', category: 'Café', lat: 49.8937, lng: 10.8869, address: 'Obstmarkt 3',
    rating: 4.4, distanceLabel: '300 m', caption: 'Zimtschnecken kommen um 9 aus dem Ofen.',
    menu: [
      { id: 'm4', name: 'Cappuccino', description: 'Hafer +0,50', priceCents: 360, currency: 'EUR' },
      { id: 'm5', name: 'Zimtschnecke', description: 'hausgemacht', priceCents: 380, currency: 'EUR' },
    ],
    confirmations: [{ id: 'c3', placeId: 'p2', by: 'owner', pricesMatch: true, createdAt: ago(5) }] },
  { id: 'p3', name: 'Trattoria Regnitz', category: 'Italienisch', lat: 49.8915, lng: 10.8830, address: 'Am Kranen 8',
    rating: 4.2, distanceLabel: '650 m', caption: 'Pizza am Wasser.',
    menu: [{ id: 'm6', name: 'Margherita', description: 'San-Marzano, Fior di Latte', priceCents: 1050, currency: 'EUR' }],
    confirmations: [{ id: 'c4', placeId: 'p3', by: 'owner', pricesMatch: true, createdAt: ago(95) }] },
  { id: 'p4', name: 'Bar Hain', category: 'Bar', lat: 49.8840, lng: 10.8930, address: 'Hainstraße 41',
    rating: 4.7, distanceLabel: '1,4 km', caption: 'Donnerstag: Negroni-Abend.',
    menu: [{ id: 'm7', name: 'Negroni', priceCents: 850, currency: 'EUR' }, { id: 'm8', name: 'Spritz', description: 'Aperol oder Limoncello', priceCents: 750, currency: 'EUR' }],
    confirmations: [{ id: 'c5', placeId: 'p4', by: 'guest', visitId: 'v2', pricesMatch: true, createdAt: ago(1) }] },
  { id: 'p5', name: 'Kebab Kettenbrücke', category: 'Imbiss', lat: 49.8950, lng: 10.8880, address: 'Kettenbrückstraße 2',
    rating: 4.3, distanceLabel: '550 m',
    menu: [{ id: 'm9', name: 'Döner', priceCents: 700, currency: 'EUR' }],
    confirmations: [] },
];
