# Glosario

GitOno se usa en español o en inglés (Apariencia → Idioma). Cada idioma tiene un solo término para cada cosa, y se usa igual en toda la app: botones, menús, avisos y errores.

En inglés se usan los términos de Git y de GitKraken. En español, la palabra común en castellano, con el término de Git entre paréntesis cuando ayuda a reconocerlo (por ejemplo en los tooltips).

| Inglés (Git / GitKraken) | Español en GitOno |
|---|---|
| Pull | Traer |
| Push | Subir |
| Fetch | Actualizar (traer novedades sin cambiar tus ramas) |
| Stash (verbo) | Guardar aparte |
| Stash (sustantivo) / Stashes | Cambios guardados / Guardados |
| Pop (stash) | Recuperar (aplicar y borrar) |
| Apply (stash) | Aplicar (queda guardado) |
| Stage / Stage file | Preparar / Preparar archivo |
| Unstage | Quitar |
| Staged / Unstaged | Preparados / Sin preparar |
| Discard | Descartar |
| Commit (sustantivo y verbo) | Commit / Hacer commit |
| Amend | Enmendar |
| Checkout | Cambiar a |
| Branch | Rama |
| Tag | Etiqueta |
| Remote | Remoto |
| Merge / merged | Fusionar / fusionada |
| Rebase | Rebasar |
| Cherry-pick | Copiar el commit (cherry-pick) |
| Revert | Revertir |
| Reset (soft / mixed / hard) | Restablecer (suave / mixto / duro) |
| Fast-forward | Avance rápido |
| Upstream | Rama remota que sigue |
| Detached HEAD | HEAD desacoplado |
| WIP | WIP (cambios sin commitear) |
| Conflict | Conflicto |
| Undo / Redo | Deshacer / Rehacer |
| Profile | Perfil |

## Cómo se usa en el código

- Cada texto visible pasa por `t('…')` (o `tn` para plurales y `tr` cuando lleva negritas o enlaces), con el español como clave. La traducción está en `src/shared/i18n.en.ts`.
- Un texto nuevo en español tiene que usar estos términos, y su traducción al inglés, los de la primera columna. El test `src/main/i18n.test.ts` falla si falta alguna traducción.
- Algunos nombres no se traducen porque son de Git o de las plataformas: commit, SHA, HEAD, pull request, merge request, `--force-with-lease`.
