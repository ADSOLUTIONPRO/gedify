# Support humain / chat conseiller

Module de support client de Gedify : conversations cloisonnées par tenant,
séparation nette **IA / humain**, file de traitement côté conseiller, SLA,
réponses types, notation et notifications email.

## Côté client (espace tenant)

Bouton flottant **« Aide & support »** (en bas à gauche, multi-tenant uniquement) :
- **Assistant IA** — ouvre l'assistant IA existant (réponse immédiate)
- **Contacter un conseiller** — `/support/new` (support humain)
- **Mes demandes** — `/support` (suivi)
- **Centre d'aide** — guides

Un client ne voit **que** les conversations de son tenant : toute lecture passe
par `getConversationForTenant(id, tenantId)` qui renvoie `null` si la conversation
appartient à un autre espace. Les **notes internes** des conseillers ne sont
jamais renvoyées au client (`is_internal = true` filtré).

Le support humain est soumis au feature flag `human_support_enabled` (offres
supérieures). Sans lui, le client garde l'assistant IA et le centre d'aide.

## Côté admin (superuser)

**Gestion clients → Support** (`/admin/saas/support`) :
- Vue d'ensemble (à traiter, non assignées, **SLA dépassé**…)
- Liste filtrable par statut, badge de messages non lus
- Détail (`/admin/saas/support/[id]`) : fil complet (+ notes internes), réponse
  conseiller **ou** note interne, assignation, changement de statut, réponses types
- **Réglages** (`/admin/saas/support/settings`) : politiques SLA + réponses types

## Statuts & SLA

Statuts : `open → pending (client a écrit) → waiting_customer (conseiller a répondu)
→ resolved → closed`. Le SLA de **première réponse** est calculé à la création
selon la priorité (urgent 1 h, haute 4 h, normale 8 h, basse 24 h). Une
conversation sans première réponse au-delà de l'échéance est signalée « SLA dépassé ».

Initialisez les politiques par défaut via la page Réglages (bouton « Initialiser »).

## Notifications email

Reliées au module Mailing (modèles `support.*`) :
- `support.ticket_received` — accusé de réception au client
- `support.agent_reply` — réponse d'un conseiller (hors notes internes)
- `support.ticket_resolved` — demande résolue

Best-effort : un échec d'email ne bloque jamais l'action de support.

## Vérification

```bash
npm run saas:check-support   # stats + contrôle d'isolation tenant (lecture seule)
```

Le script vérifie notamment qu'aucune conversation/message n'est sans `tenant_id`,
qu'il n'y a pas de message orphelin, et que le `tenant_id` d'un message correspond
à celui de sa conversation.
