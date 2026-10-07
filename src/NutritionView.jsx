import { requestLocal } from "./storage";
import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Camera } from "lucide-react";
import { Plus } from "lucide-react";
import { Pencil } from "lucide-react";
import { Utensils } from "lucide-react";
import * as ReactJSX from "react/jsx-runtime";
import {
  DEFAULT_NUTRITION_TARGETS,
  MealSchema,
  NutritionTargetsSchema,
  addDays,
  dateKey,
  formatDate,
  sumNutrients,
} from "./domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui";
var newId = () =>
  typeof crypto.randomUUID == `function`
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (e) =>
        e.toString(16).padStart(2, `0`),
      ).join(``);
var NUTRIENT_KEYS = [`calories`, `protein`, `carbs`, `fat`];
var NUTRIENT_LABELS = {
  calories: `Calories · kcal`,
  protein: `Protein · g`,
  carbs: `Carbs · g`,
  fat: `Fat · g`,
};
var emptyFood = () => ({
  name: ``,
  portion: ``,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});
var emptyMeal = () => ({
  kind: `meal`,
  name: ``,
  foods: [emptyFood()],
  source: `manual`,
  notes: ``,
  assumptions: ``,
  confidence: null,
});
var roundNutrient = (e) => Math.round(e * 10) / 10;
async function requestNutrition(path, payload) {
  return requestLocal(path, payload);
}
async function resizeMealPhoto(e) {
  if (e.size > 25 * 1024 * 1024)
    throw Error(`Choose a photo smaller than 25 MB.`);
  let t = URL.createObjectURL(e);
  try {
    let e = new Image();
    e.src = t;
    await e.decode();
    let n = Math.min(1, 1600 / Math.max(e.width, e.height));
    let r = document.createElement(`canvas`);
    r.width = Math.round(e.width * n);
    r.height = Math.round(e.height * n);
    let i = r.getContext(`2d`);
    if (!i) throw Error(`This photo couldn’t load.`);
    i.drawImage(e, 0, 0, r.width, r.height);
    let a = r.toDataURL(`image/jpeg`, 0.78);
    if (a.length > 22e5)
      throw Error(`This photo is too large. Choose a smaller photo.`);
    return a;
  } finally {
    URL.revokeObjectURL(t);
  }
}
function NutritionView({ bodyWeight: bodyWeight }) {
  let [selectedDate, setSelectedDate] = React.useState(() =>
    dateKey(new Date()),
  );
  let [records, setRecords] = React.useState([]);
  let [loaded, setLoaded] = React.useState(!1);
  let [photoAnalysisReady, setPhotoAnalysisReady] = React.useState(!1);
  let [loadError, setLoadError] = React.useState(``);
  let [saving, setSaving] = React.useState(!1);
  let [mealDraft, setMealDraft] = React.useState(null);
  let [editingMeal, setEditingMeal] = React.useState(null);
  let [mealDate, setMealDate] = React.useState(selectedDate);
  let [draftError, setDraftError] = React.useState(``);
  let [photoDialogOpen, setPhotoDialogOpen] = React.useState(!1);
  let [photoDataUrl, setPhotoDataUrl] = React.useState(``);
  let [photoDetails, setPhotoDetails] = React.useState(``);
  let [photoError, setPhotoError] = React.useState(``);
  let [analyzing, setAnalyzing] = React.useState(!1);
  let [targetsOpen, setTargetsOpen] = React.useState(!1);
  let [targetsDraft, setTargetsDraft] = React.useState(
    DEFAULT_NUTRITION_TARGETS,
  );
  let [weightInput, setWeightInput] = React.useState(``);
  let [weightError, setWeightError] = React.useState(``);
  let newMealIdRef = React.useRef(newId());
  let cameraInputRef = React.useRef(null);
  let fileInputRef = React.useRef(null);
  async function loadNutrition() {
    try {
      setLoadError(``);
      let e = await requestNutrition(`/api/nutrition`);
      setRecords(e.records);
      setPhotoAnalysisReady(e.photoAnalysisReady);
      setLoaded(!0);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : `Your log couldn’t load.`);
    }
  }
  React.useEffect(() => {
    loadNutrition();
  }, []);
  let targetsRecord = records.find((e) => e.payload.kind === `targets`);
  let targets =
    targetsRecord?.payload.kind === `targets`
      ? targetsRecord.payload
      : DEFAULT_NUTRITION_TARGETS;
  let mealsForDay = records.filter(
    (e) => e.date === selectedDate && e.payload.kind === `meal`,
  );
  let dailyTotals = sumNutrients(
    mealsForDay.flatMap((e) =>
      e.payload.kind === `meal` ? e.payload.foods : [],
    ),
  );
  let weightRecords = records
    .filter((e) => e.payload.kind === `weight`)
    .sort((e, t) => t.date.localeCompare(e.date));
  let latestWeightRecord = weightRecords[0];
  function averageWeight(e, t) {
    let n = dateKey(new Date());
    let r = dateKey(addDays(new Date(n + `T12:00:00`), -t));
    let i = dateKey(addDays(new Date(n + `T12:00:00`), -e));
    let a = weightRecords.filter((e) => e.date >= r && e.date <= i);
    return a.length
      ? a.reduce(
          (e, t) => e + (t.payload.kind === `weight` ? t.payload.kg : 0),
          0,
        ) / a.length
      : null;
  }
  let currentWeekWeight = averageWeight(0, 6);
  let previousWeekWeight = averageWeight(7, 13);
  async function saveNutritionRecord(e, t) {
    let n = await requestNutrition(`/api/nutrition`, {
      ...e,
      expectedVersion: t,
    });
    setRecords((t) => [
      {
        ...e,
        version: n.version,
      },
      ...t.filter((t) => t.id !== e.id),
    ]);
  }
  async function saveMeal() {
    if (!mealDraft || saving) return;
    setDraftError(``);
    let e = MealSchema.safeParse(mealDraft);
    if (!e.success) {
      setDraftError(
        `Enter a meal name, a name for each food, and valid amounts.`,
      );
      return;
    }
    setSaving(!0);
    try {
      await saveNutritionRecord(
        {
          id: editingMeal?.id ?? newMealIdRef.current,
          date: mealDate,
          payload: e.data,
        },
        editingMeal?.version ?? 0,
      );
      setMealDraft(null);
      setEditingMeal(null);
    } catch (e) {
      setDraftError(
        e instanceof Error ? e.message : `Couldn’t save this meal.`,
      );
    } finally {
      setSaving(!1);
    }
  }
  async function setPhotoFile(e) {
    if (e) {
      setPhotoError(``);
      try {
        setPhotoDataUrl(await resizeMealPhoto(e));
      } catch (e) {
        setPhotoError(
          e instanceof Error ? e.message : `Choose a JPEG or PNG photo.`,
        );
      }
    }
  }
  async function analyzePhoto() {
    if (!(!photoDataUrl || !photoAnalysisReady || analyzing)) {
      setPhotoError(``);
      setAnalyzing(!0);
      try {
        let e = await requestNutrition(`/api/nutrition/analyze`, {
          image: photoDataUrl,
          details: photoDetails,
        });
        newMealIdRef.current = newId();
        setEditingMeal(null);
        setMealDate(selectedDate);
        setMealDraft(e.meal);
        setDraftError(``);
        setPhotoDialogOpen(!1);
      } catch (e) {
        setPhotoError(
          e instanceof Error ? e.message : `Analysis failed. Try again.`,
        );
      } finally {
        setAnalyzing(!1);
      }
    }
  }
  function addMeal() {
    newMealIdRef.current = newId();
    setEditingMeal(null);
    setMealDate(selectedDate);
    setMealDraft(emptyMeal());
    setDraftError(``);
  }
  let todayWeightRecord = records.find(
    (e) => e.id === `weight-` + selectedDate,
  );
  return (
    <div className={`nutrition-view`}>
      {loadError && (
        <div className={`error-banner`} role={`alert`}>
          <p>{loadError}</p>
          <button
            className={`btn btn-small`}
            onClick={() => void loadNutrition()}
          >{`Retry`}</button>
        </div>
      )}
      <div className={`nutrition-toolbar`}>
        <div className={`nutrition-date`}>
          <button
            className={`icon-button`}
            aria-label={`Previous nutrition day`}
            onClick={() =>
              setSelectedDate(
                dateKey(addDays(new Date(selectedDate + `T12:00:00`), -1)),
              )
            }
          >
            <ChevronLeft size={18} />
          </button>
          <label>
            <span className={`sr-only`}>{`Nutrition date`}</span>
            <input
              type={`date`}
              value={selectedDate}
              onChange={(e) => {
                e.target.value && setSelectedDate(e.target.value);
              }}
            />
          </label>
          <button
            className={`icon-button`}
            aria-label={`Next nutrition day`}
            onClick={() =>
              setSelectedDate(
                dateKey(addDays(new Date(selectedDate + `T12:00:00`), 1)),
              )
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className={`nutrition-actions`}>
          <button
            className={`btn secondary`}
            onClick={() => {
              setPhotoDialogOpen(!0);
              setPhotoError(``);
            }}
          >
            <Camera size={17} />
            {` Meal photo`}
          </button>
          <button className={`btn`} onClick={addMeal}>
            <Plus size={17} />
            {` Add meal`}
          </button>
        </div>
      </div>
      <div className={`nutrition-totals`}>
        {NUTRIENT_KEYS.map((e) => (
          <section className={`panel nutrient-card`} key={e}>
            <span className={`small-label`}>{NUTRIENT_LABELS[e]}</span>
            <strong>{roundNutrient(dailyTotals[e])}</strong>
            <span className={`muted`}>
              {targets[e] === null
                ? `No target set`
                : `of ${targets[e]} ${e === `calories` ? `kcal` : `g`}`}
            </span>
            {targets[e] !== null && targets[e] > 0 && (
              <progress
                value={Math.min(dailyTotals[e], targets[e])}
                max={targets[e]}
                aria-label={NUTRIENT_LABELS[e] + ` daily progress`}
              />
            )}
          </section>
        ))}
      </div>
      <div className={`nutrition-layout`}>
        <section className={`panel nutrition-meals`}>
          <div className={`panel-heading`}>
            <h2>
              {formatDate(selectedDate)}
              {` · meals`}
            </h2>
            <span className={`muted`}>
              {mealsForDay.length}
              {` logged`}
            </span>
          </div>
          {mealsForDay.length ? (
            mealsForDay.map((e) => {
              let t = e.payload;
              let n = sumNutrients(t.foods);
              return (
                <button
                  className={`nutrition-meal`}
                  onClick={() => {
                    setEditingMeal(e);
                    setMealDate(e.date);
                    setMealDraft(structuredClone(t));
                    setDraftError(``);
                  }}
                  key={e.id}
                >
                  <div>
                    <strong>{t.name}</strong>
                    <small>{t.foods.map((e) => e.name).join(`, `)}</small>
                    <span className={`muted`}>
                      {t.source === `photo`
                        ? `Photo estimate · reviewed`
                        : `Entered manually`}
                    </span>
                  </div>
                  <div>
                    <strong>
                      {roundNutrient(n.calories)}
                      {` kcal`}
                    </strong>
                    <small>
                      {roundNutrient(n.protein)}
                      {` g protein · `}
                      {roundNutrient(n.carbs)}
                      {` g carbs`}
                    </small>
                    <Pencil size={15} />
                  </div>
                </button>
              );
            })
          ) : (
            <div className={`empty-state`}>
              <Utensils size={30} />
              <h3>
                {loaded
                  ? `What did you eat today?`
                  : `Load your log to see saved meals.`}
              </h3>
              <p>{`Enter a meal or use a photo estimate, then review the portions.`}</p>
              <button
                className={`text-button`}
                onClick={addMeal}
              >{`Add your first meal`}</button>
            </div>
          )}
          <p
            className={`small-note`}
          >{`Totals reflect what you logged. Photo estimates and entered amounts may differ from actual intake.`}</p>
        </section>
        <aside className={`nutrition-sidebar`}>
          <section className={`panel`}>
            <div className={`panel-heading`}>
              <h3>{`Your targets`}</h3>
              <button
                className={`text-button`}
                onClick={() => {
                  setTargetsDraft({
                    ...targets,
                  });
                  setDraftError(``);
                  setTargetsOpen(!0);
                }}
              >{`Edit`}</button>
            </div>
            <p>{`Goal: gain weight while supporting volleyball and strength training.`}</p>
            <p className={`muted`}>
              {`Goal weight: `}
              {targets.goalWeight === null
                ? `choose when you’re ready`
                : `${targets.goalWeight} kg`}
            </p>
            <p
              className={`small-note`}
            >{`Targets are your choices. The app doesn’t prescribe a calorie intake or automatically add workout calories to it.`}</p>
          </section>
          <section className={`panel`}>
            <h3>{`Weight check-in`}</h3>
            <p className={`muted`}>
              {latestWeightRecord &&
              latestWeightRecord.payload.kind === `weight`
                ? `Latest: ${latestWeightRecord.payload.kg} kg · ${formatDate(latestWeightRecord.date)}`
                : `Workout profile: ${bodyWeight} kg`}
            </p>
            <label className={`field-label`}>
              {`Body weight · kg`}
              <input
                type={`number`}
                min={`20`}
                max={`400`}
                step={`0.1`}
                value={weightInput}
                placeholder={
                  todayWeightRecord?.payload.kind === `weight`
                    ? String(todayWeightRecord.payload.kg)
                    : `e.g. 61.0`
                }
                onChange={(e) => setWeightInput(e.target.value)}
              />
            </label>
            <p className={`small-note`}>
              {`Save for `}
              {formatDate(selectedDate)}
              {`. Use similar conditions for each check-in.`}
            </p>
            {weightError && (
              <p className={`nutrition-error`} role={`alert`}>
                {weightError}
              </p>
            )}
            <button
              className={`btn secondary full`}
              disabled={!loaded || saving || !weightInput}
              onClick={async () => {
                setWeightError(``);
                let e = Number(weightInput);
                if (!Number.isFinite(e) || e < 20 || e > 400) {
                  setWeightError(`Enter a weight between 20 and 400 kg.`);
                  return;
                }
                setSaving(!0);
                try {
                  await saveNutritionRecord(
                    {
                      id: `weight-` + selectedDate,
                      date: selectedDate,
                      payload: {
                        kind: `weight`,
                        kg: e,
                      },
                    },
                    todayWeightRecord?.version ?? 0,
                  );
                  setWeightInput(``);
                } catch (e) {
                  setWeightError(
                    e instanceof Error ? e.message : `Couldn’t save.`,
                  );
                } finally {
                  setSaving(!1);
                }
              }}
            >{`Save weight`}</button>
            {currentWeekWeight !== null && (
              <p className={`nutrition-weight-average`}>
                <strong>
                  {roundNutrient(currentWeekWeight)}
                  {` kg`}
                </strong>
                {` · average of recorded check-ins in the last 7 days`}
                {previousWeekWeight !== null && (
                  <small>
                    {roundNutrient(currentWeekWeight - previousWeekWeight) >= 0
                      ? `+`
                      : ``}
                    {roundNutrient(currentWeekWeight - previousWeekWeight)}
                    {` kg compared with the previous 7 days`}
                  </small>
                )}
              </p>
            )}
          </section>
          <section className={`panel nutrition-guidance`}>
            <h3>{`Fuel for volleyball`}</h3>
            <p>{`Use the log to understand your eating pattern alongside your energy, recovery, and training performance.`}</p>
            <p>{`Carbohydrates, protein, and hydration all matter for fueling and recovery.`}</p>
            <a
              className={`text-button`}
              href={`https://www.ausport.gov.au/ais/nutrition/performance-nutrition-hq-modules`}
              target={`_blank`}
              rel={`noreferrer`}
            >{`AIS performance nutrition guide`}</a>
          </section>
        </aside>
      </div>
      <Dialog
        open={photoDialogOpen}
        onOpenChange={(e) => {
          analyzing || setPhotoDialogOpen(e);
        }}
      >
        <DialogContent className={`app-dialog nutrition-dialog`}>
          <DialogHeader>
            <DialogTitle>{`Estimate a meal from a photo`}</DialogTitle>
            <DialogDescription>{`Take a clear photo of the whole serving. Add portion sizes and ingredients you know.`}</DialogDescription>
          </DialogHeader>
          <input
            ref={cameraInputRef}
            type={`file`}
            accept={`image/*`}
            capture={`environment`}
            hidden={!0}
            onChange={(e) => {
              setPhotoFile(e.target.files?.[0]);
              e.target.value = ``;
            }}
          />
          <input
            ref={fileInputRef}
            type={`file`}
            accept={`image/*`}
            hidden={!0}
            onChange={(e) => {
              setPhotoFile(e.target.files?.[0]);
              e.target.value = ``;
            }}
          />
          <div className={`nutrition-actions`}>
            <button
              className={`btn secondary`}
              disabled={analyzing}
              onClick={() => cameraInputRef.current?.click()}
            >{`Take photo`}</button>
            <button
              className={`btn secondary`}
              disabled={analyzing}
              onClick={() => fileInputRef.current?.click()}
            >{`Choose photo`}</button>
          </div>
          {photoDataUrl && (
            <img
              className={`meal-photo-preview`}
              src={photoDataUrl}
              alt={`Meal to review`}
            />
          )}
          <label className={`field-label`}>
            {`Portions, ingredients, oils or sauces`}
            <textarea
              maxLength={1e3}
              value={photoDetails}
              onChange={(e) => setPhotoDetails(e.target.value)}
              placeholder={`e.g. 150 g cooked rice, one chicken breast, 1 tbsp olive oil`}
            />
          </label>
          {!photoAnalysisReady && (
            <div className={`info-box`}>
              <h3>{`Photo analysis needs setup`}</h3>
              <p>{`Automatic photo analysis is unavailable in this offline app. Enter food names and nutrition values manually to save your meal.`}</p>
            </div>
          )}
          <p
            className={`small-note`}
          >{`Photos stay on this device and are never uploaded. For an accurate log, enter values from food labels and review portion sizes.`}</p>
          {photoError && (
            <p className={`nutrition-error`} role={`alert`}>
              {photoError}
            </p>
          )}
          <button
            className={`btn full`}
            disabled={!photoAnalysisReady || !photoDataUrl || analyzing}
            onClick={() => void analyzePhoto()}
          >
            {analyzing ? `Estimating your meal…` : `Analyze and review`}
          </button>
          <button
            className={`text-button`}
            disabled={analyzing}
            onClick={() => {
              setPhotoDialogOpen(!1);
              addMeal();
            }}
          >{`Enter meal manually`}</button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={mealDraft !== null}
        onOpenChange={(e) => {
          !e && !saving && setMealDraft(null);
        }}
      >
        <DialogContent className={`app-dialog nutrition-dialog`}>
          <DialogHeader>
            <DialogTitle>
              {editingMeal
                ? `Edit meal`
                : mealDraft?.source === `photo`
                  ? `Review your estimate`
                  : `Add a meal`}
            </DialogTitle>
            <DialogDescription>
              {mealDraft?.source === `photo`
                ? `Check the food, portions, and totals before saving. These are approximate amounts.`
                : `Use food labels or your own estimates. Enter values for the whole serving.`}
            </DialogDescription>
          </DialogHeader>
          {mealDraft && (
            <ReactJSX.Fragment>
              <label className={`field-label`}>
                {`Meal name`}
                <input
                  maxLength={100}
                  value={mealDraft.name}
                  onChange={(e) =>
                    setMealDraft({
                      ...mealDraft,
                      name: e.target.value,
                    })
                  }
                />
              </label>
              <label className={`field-label`}>
                {`Meal date`}
                <input
                  type={`date`}
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                />
              </label>
              {mealDraft.source === `photo` && (
                <div className={`info-box`}>
                  <strong>
                    {mealDraft.confidence}
                    {` confidence · estimate`}
                  </strong>
                  <p>{mealDraft.assumptions}</p>
                </div>
              )}
              {mealDraft.foods.map((e, t) => (
                <section className={`nutrition-food-editor`} key={t}>
                  <label className={`field-label`}>
                    {`Food `}
                    {t + 1}
                    <input
                      value={e.name}
                      maxLength={100}
                      onChange={(e) =>
                        setMealDraft({
                          ...mealDraft,
                          foods: mealDraft.foods.map((n, r) =>
                            r === t
                              ? {
                                  ...n,
                                  name: e.target.value,
                                }
                              : n,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className={`field-label`}>
                    {`Serving / portion`}
                    <input
                      value={e.portion}
                      maxLength={100}
                      placeholder={`e.g. 150 g cooked`}
                      onChange={(e) =>
                        setMealDraft({
                          ...mealDraft,
                          foods: mealDraft.foods.map((n, r) =>
                            r === t
                              ? {
                                  ...n,
                                  portion: e.target.value,
                                }
                              : n,
                          ),
                        })
                      }
                    />
                  </label>
                  <div className={`nutrition-macro-inputs`}>
                    {NUTRIENT_KEYS.map((n) => (
                      <label className={`field-label`} key={n}>
                        {NUTRIENT_LABELS[n]}
                        <input
                          type={`number`}
                          min={`0`}
                          max={`20000`}
                          step={`0.1`}
                          value={e[n]}
                          onChange={(e) =>
                            setMealDraft({
                              ...mealDraft,
                              foods: mealDraft.foods.map((r, i) =>
                                i === t
                                  ? {
                                      ...r,
                                      [n]: Number(e.target.value),
                                    }
                                  : r,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {mealDraft.foods.length > 1 && (
                    <button
                      className={`text-button`}
                      onClick={() =>
                        setMealDraft({
                          ...mealDraft,
                          foods: mealDraft.foods.filter((e, n) => n !== t),
                        })
                      }
                    >{`Remove food from draft`}</button>
                  )}
                </section>
              ))}
              <button
                className={`btn secondary`}
                disabled={mealDraft.foods.length >= 30}
                onClick={() =>
                  setMealDraft({
                    ...mealDraft,
                    foods: [...mealDraft.foods, emptyFood()],
                  })
                }
              >{`Add another food`}</button>
              <label className={`field-label`}>
                {`Meal notes`}
                <textarea
                  maxLength={1e3}
                  value={mealDraft.notes}
                  onChange={(e) =>
                    setMealDraft({
                      ...mealDraft,
                      notes: e.target.value,
                    })
                  }
                />
              </label>
              <div className={`nutrition-draft-total`}>
                {`Total: `}
                {roundNutrient(sumNutrients(mealDraft.foods).calories)}
                {` kcal · `}
                {roundNutrient(sumNutrients(mealDraft.foods).protein)}
                {` g protein`}
              </div>
              {draftError && (
                <p className={`nutrition-error`} role={`alert`}>
                  {draftError}
                </p>
              )}
              <button
                className={`btn full`}
                disabled={!loaded || saving}
                onClick={() => void saveMeal()}
              >
                {saving ? `Saving…` : `Save meal`}
              </button>
              {!loaded && (
                <p
                  className={`small-note`}
                >{`Your nutrition log is saved on this device. If saving is unavailable, check that your browser allows local storage.`}</p>
              )}
            </ReactJSX.Fragment>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={targetsOpen}
        onOpenChange={(e) => {
          saving || setTargetsOpen(e);
        }}
      >
        <DialogContent className={`app-dialog`}>
          <DialogHeader>
            <DialogTitle>{`Your nutrition targets`}</DialogTitle>
            <DialogDescription>{`Optional daily targets. Leave fields empty if you haven’t chosen them yet.`}</DialogDescription>
          </DialogHeader>
          {NUTRIENT_KEYS.map((e) => (
            <label className={`field-label`} key={e}>
              {NUTRIENT_LABELS[e]}
              <input
                type={`number`}
                min={`0`}
                max={`20000`}
                step={`1`}
                value={targetsDraft[e] ?? ``}
                onChange={(t) =>
                  setTargetsDraft({
                    ...targetsDraft,
                    [e]: t.target.value === `` ? null : Number(t.target.value),
                  })
                }
              />
            </label>
          ))}
          <label className={`field-label`}>
            {`Goal weight · kg`}
            <input
              type={`number`}
              min={`20`}
              max={`400`}
              step={`0.1`}
              value={targetsDraft.goalWeight ?? ``}
              onChange={(e) =>
                setTargetsDraft({
                  ...targetsDraft,
                  goalWeight:
                    e.target.value === `` ? null : Number(e.target.value),
                })
              }
            />
          </label>
          {draftError && (
            <p className={`nutrition-error`} role={`alert`}>
              {draftError}
            </p>
          )}
          <button
            className={`btn full`}
            disabled={!loaded || saving}
            onClick={async () => {
              let e = NutritionTargetsSchema.safeParse(targetsDraft);
              if (!e.success) {
                setDraftError(`Check your target values.`);
                return;
              }
              setSaving(!0);
              try {
                await saveNutritionRecord(
                  {
                    id: `targets`,
                    date: selectedDate,
                    payload: e.data,
                  },
                  targetsRecord?.version ?? 0,
                );
                setTargetsOpen(!1);
              } catch (e) {
                setDraftError(
                  e instanceof Error ? e.message : `Couldn’t save.`,
                );
              } finally {
                setSaving(!1);
              }
            }}
          >
            {saving ? `Saving…` : `Save targets`}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export {
  newId,
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  emptyFood,
  emptyMeal,
  roundNutrient,
  requestNutrition,
  resizeMealPhoto,
  NutritionView,
};
