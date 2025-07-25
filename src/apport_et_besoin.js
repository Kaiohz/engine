import enums from './enums.js';
import { calc_sse } from './6.2_surface_sud_equivalente.js';
import calc_besoin_fr from './10_besoin_fr.js';
import calc_besoin_ecs from './11_besoin_ecs.js';
import { Nadeq } from './11_nadeq.js';
import { calc_ai, calc_as } from './6.1_apport_gratuit.js';

const nadeqService = new Nadeq();

export default function calc_apport_et_besoin(
  logement,
  th,
  ecs,
  clim,
  Sh,
  Nb_lgt,
  GV,
  ilpa,
  ca_id,
  zc_id
) {
  const zc = enums.zone_climatique[zc_id];
  const ca = enums.classe_altitude[ca_id];

  const enveloppe = logement.enveloppe;
  const inertie = enums.classe_inertie[enveloppe.inertie.enum_classe_inertie_id];

  const bv = enveloppe.baie_vitree_collection?.baie_vitree || [];
  const ets = enveloppe.ets_collection?.ets || [];

  const nadeq = nadeqService.calculateNadeq(logement);

  const besoin_ecs = calc_besoin_ecs(ca, zc, nadeq);
  const besoin_fr = calc_besoin_fr(ca, zc, Sh, nadeq, GV, inertie, bv, ets);
  const apport_interne = calc_ai(ilpa, ca, zc, Sh, nadeq);
  const apport_solaire = calc_as(ilpa, ca, zc, bv, ets);

  if (clim.length === 0) {
    besoin_fr.besoin_fr = 0;
    besoin_fr.besoin_fr_depensier = 0;
    apport_interne.apport_interne_fr = 0;
    apport_solaire.apport_solaire_fr = 0;
  }

  return {
    nadeq,
    v40_ecs_journalier: nadeq * 56,
    v40_ecs_journalier_depensier: nadeq * 79,
    surface_sud_equivalente: calc_sse(ca, zc, bv, ets),
    ...besoin_ecs,
    ...apport_interne,
    ...apport_solaire,
    ...besoin_fr
  };
}
