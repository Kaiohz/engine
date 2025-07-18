import enums from './enums.js';
import b from './3.1_b.js';
import { tv, requestInput, getKeyByValue, bug_for_bug_compat, getRange } from './utils.js';

const scriptName = new URL(import.meta.url).pathname.split('/').pop();

function tv_upb0(di, de, du) {
  requestInput(de, du, 'type_plancher_bas');
  const matcher = {
    enum_type_plancher_bas_id: de.enum_type_plancher_bas_id
  };
  const row = tv('upb0', matcher, de);
  if (row) {
    di.upb0 = Number(row.upb0);
    de.tv_upb0_id = Number(row.tv_upb0_id);
  } else {
    console.error('!! pas de valeur forfaitaire trouvée pour upb0 !!');
  }
}

function tv_upb(di, de, du, pc_id, zc, effetJoule) {
  if (bug_for_bug_compat && de.tv_upb_id) {
    /**
     * Vérification de la variable effet_joule
     * Certains DPE utilise de manière erronée cette variable. Pour rester cohérent avec le DPE, utilisation de la variable
     * effet_joule telle qu'elle est utilisée dans le DPE
     */
    const rowUpb = tv('upb', {
      tv_upb_id: de.tv_upb_id
    });

    if (rowUpb && rowUpb.effet_joule !== effetJoule) {
      console.error(
        `La variable effet_joule utilisée dans le DPE pour le plancher bas '${de.description}' est ${rowUpb.effet_joule}.
        Celle-ci devrait être ${effetJoule}. La valeur ${rowUpb.effet_joule} est conservée dans la suite des calculs`
      );

      effetJoule = rowUpb.effet_joule;
    }
  }

  const matcher = {
    enum_periode_construction_id: pc_id,
    enum_zone_climatique_id: zc,
    effet_joule: effetJoule
  };
  const row = tv('upb', matcher, de);
  if (row) {
    di.upb = Number(row.upb);
    de.tv_upb_id = Number(row.tv_upb_id);
  } else {
    console.error('!! pas de valeur forfaitaire trouvée pour upb !!');
  }
}

const values_2s_p = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20];

function tv_ue(di, de, du, pc_id, pb_list) {
  const type_adjacence = enums.type_adjacence[de.enum_type_adjacence_id];
  let type_adjacence_plancher;
  let upb1, upb2;
  if (type_adjacence === 'terre-plein') {
    if (Number(pc_id) < 7) {
      type_adjacence_plancher = 'terre plein bâtiment construit avant 2001';
      [upb1, upb2] = getRange(di.upb, [0.46, 0.59, 0.85, 1.5, 3.4]);
    } else {
      type_adjacence_plancher = 'terre plein bâtiment construit à partir de 2001';
      [upb1, upb2] = getRange(di.upb, [0.31, 0.37, 0.46, 0.6, 0.85, 1.5, 3.4]);
    }
  } else {
    type_adjacence_plancher = 'plancher sur vide sanitaire ou sous-sol non chauffé';
    [upb1, upb2] = getRange(di.upb, [0.31, 0.34, 0.37, 0.41, 0.45, 0.83, 1.43, 3.33]);
  }

  /**
   * La surface Ue est la surface de tous les planchers bas ayant le même type d'adjacence
   * Le périmètre Ue est le périmètre de tous les planchers bas ayant le même type d'adjacence
   */
  const { surfaceUe, perimetreUe } = pb_list.reduce(
    (acc, plancherBas) => {
      if (plancherBas.donnee_entree.enum_type_adjacence_id === de.enum_type_adjacence_id) {
        acc.surfaceUe +=
          plancherBas.donnee_entree.surface_ue || plancherBas.donnee_entree.surface_paroi_opaque;
        acc.perimetreUe += plancherBas.donnee_entree.perimetre_ue || 0;
      }
      return acc;
    },
    { surfaceUe: 0, perimetreUe: 0 }
  );

  const matcher = {
    type_adjacence_plancher,
    '2s_p': Math.round((2 * surfaceUe) / perimetreUe)
  };
  matcher['2s_p'] = values_2s_p.reduce((prev, curr) => {
    return Math.abs(curr - matcher['2s_p']) < Math.abs(prev - matcher['2s_p']) ? curr : prev;
  });

  matcher['2s_p'] = `^${matcher['2s_p']}$`;

  const matcher_1 = { ...matcher, ...{ upb: String(upb1) } };
  const matcher_2 = { ...matcher, ...{ upb: String(upb2) } };
  const row_1 = tv('ue', matcher_1);
  const row_2 = tv('ue', matcher_2);

  const delta_ue = Number(row_2.ue) - Number(row_1.ue);
  const delta_upb = upb2 - upb1;

  let ue;
  if (delta_upb === 0) {
    ue = Number(row_1.ue);
  } else {
    // Interpolation linéaire si di.upb n'est pas une valeur connue
    ue = Number(row_1.ue) + (delta_ue * (di.upb - upb1)) / delta_upb;
  }
  de.ue = ue;
}

function calc_upb0(di, de, du) {
  const methode_saisie_u0 = requestInput(de, du, 'methode_saisie_u0');
  switch (methode_saisie_u0) {
    case 'type de paroi inconnu (valeur par défaut)':
    case 'déterminé selon le matériau et épaisseur à partir de la table de valeur forfaitaire':
      tv_upb0(di, de, du);
      break;
    case 'saisie direct u0 justifiée à partir des documents justificatifs autorisés':
    case "saisie direct u0 correspondant à la performance de la paroi avec son isolation antérieure iti (umur_iti) lorsqu'il y a une surisolation ite réalisée":
      di.upb0 = requestInput(de, du, 'upb0_saisi', 'float');
      break;
    case 'u0 non saisi car le u est saisi connu et justifié.':
      break;
    default:
      console.warn('methode_saisie_u0 inconnue:', methode_saisie_u0);
  }
}

export default function calc_pb(pb, zc, pc_id, effetJoule, pb_list) {
  const de = pb.donnee_entree;
  const du = {};
  const di = {};
  di.upb0 = pb.donnee_intermediaire?.upb0;

  b(di, de, du, zc);

  let methode_saisie_u = parseInt(de.enum_methode_saisie_u_id);

  if (bug_for_bug_compat) {
    // Si la résistance de l'isolation est connue mais que le mode de saisie de u n'est pas
    // 'resistance isolation saisie justifiée'. On force cette méthode de saisie
    if (de.resistance_isolation && ![5, 6].includes(methode_saisie_u)) {
      console.error(`
        La résistance de l'isolation du plancher bas ${de.description} est connue mais la méthode de saisie du facteur u
        n'est pas 'resistance isolation saisie justifiée'. La méthode de saisie est modifiée pour la suite du calcul
      `);
      methode_saisie_u = 5;
    }
    // Si l'épaisseur de l'isolation est connue mais que le mode de saisie de u n'est pas
    // 'epaisseur isolation saisie justifiée' on force cette méthode de saisie
    if (de.epaisseur_isolation && ![3, 4].includes(methode_saisie_u)) {
      console.error(`
        L'épaisseur de l'isolation du plancher bas ${de.description} est connue mais la méthode de saisie du facteur u
        n'est pas 'epaisseur isolation saisie justifiée'. La méthode de saisie est modifiée pour la suite du calcul
      `);
      methode_saisie_u = 3;
    }
    // Si Upb est saisi mais que le mode de saisie de u n'est pas 'saisie direct u' on force cette méthode de saisie.
    if (de.upb_saisi && ![9, 10].includes(methode_saisie_u)) {
      console.error(`
        Upb du plancher bas ${de.description} est saisi mais la méthode de saisie du facteur u
        n'est pas 'saisie direct u'. La méthode de saisie est modifiée pour la suite du calcul
      `);
      methode_saisie_u = 9;
    }
  }

  switch (methode_saisie_u) {
    case 1:
      // 1 - non isolé
      calc_upb0(di, de, du);
      di.upb = di.upb0;
      break;
    case 3:
    case 4: {
      // 3 - epaisseur isolation saisie justifiée par mesure ou observation
      // 4 - epaisseur isolation saisie justifiée à partir des documents justificatifs autorisés
      const e = parseFloat(de.epaisseur_isolation) * 0.01;
      calc_upb0(di, de, du);
      di.upb = 1 / (1 / di.upb0 + e / 0.042);
      break;
    }
    case 5:
    case 6: {
      // 5 - resistance isolation saisie justifiée observation de l'isolant installé et mesure de son épaisseur
      // 6 - resistance isolation saisie justifiée  à partir des documents justificatifs autorisés
      const r = parseFloat(de.resistance_isolation);
      calc_upb0(di, de, du);
      di.upb = 1 / (1 / di.upb0 + r);
      break;
    }
    case 2:
    case 7: {
      // 2 - isolation inconnue  (table forfaitaire)
      // 7 - année d'isolation différente de l'année de construction saisie justifiée (table forfaitaire)
      calc_upb0(di, de, du);
      tv_upb(di, de, du, de.enum_periode_isolation_id || pc_id, zc, effetJoule);
      di.upb = Math.min(di.upb, di.upb0);
      break;
    }
    case 8: {
      // 8 - année de construction saisie (table forfaitaire)
      // Si l'année d'isolation est connue, il faut l'utiliser et pas l'année de construction
      let pi_id = de.enum_periode_isolation_id || pc_id;
      if (!de.enum_periode_isolation_id) {
        const pc = enums.periode_construction[pc_id];
        switch (pc) {
          case 'avant 1948':
          case '1948-1974':
            pi_id = getKeyByValue(enums.periode_isolation, '1975-1977');
            break;
        }
      }
      calc_upb0(di, de, du);
      const tv_upb_avant = de.tv_upb_id;
      tv_upb(di, de, du, pi_id, zc, effetJoule);
      if (de.tv_upb_id !== tv_upb_avant && pi_id !== pc_id) {
        console.warn(
          `BUG(${scriptName}) Si année de construction <74 alors Année d'isolation=75-77 (3CL page 17)`
        );
        if (bug_for_bug_compat) tv_upb(di, de, du, pc_id, zc, effetJoule);
      }
      di.upb = Math.min(di.upb, di.upb0);
      break;
    }
    case 9:
    case 10:
      // 9 - saisie direct u justifiée (à partir des documents justificatifs autorisés)
      // 10 - saisie direct u depuis rset/rsee( etude rt2012/re2020)
      di.upb = requestInput(de, du, 'upb_saisi', 'float');
      break;
    default:
      console.warn('methode_saisie_u inconnue:', methode_saisie_u);
  }

  const type_adjacence = requestInput(de, du, 'type_adjacence');
  switch (type_adjacence) {
    case 'vide sanitaire':
    case 'sous-sol non chauffé':
    case 'terre-plein':
      tv_ue(di, de, du, pc_id, pb_list);
      di.upb_final = de.ue;
      break;
    default:
      di.upb_final = di.upb;
      break;
  }

  pb.donnee_utilisateur = du;
  pb.donnee_intermediaire = di;
}
