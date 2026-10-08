import { requestLocal } from "./storage";
import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Camera } from "lucide-react";
import { Plus } from "lucide-react";
import { Utensils } from "lucide-react";
import * as ReactJSX from "react/jsx-runtime";
import NutritionCalculator from "./NutritionCalculator";
import { MealRoutineCue } from "./RemindersPanel";
import "./nutrition-premium.css";
import { simpleFoodGuidance } from "./nutrition-goals";
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
function NutritionView({ bodyWeight: bodyWeight, dailyGuidance, nutritionProfile, onNutritionProfileChange, volleyballSchedule, onOpenRoutine, initialAction, onActionHandled }) {
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
  let [profileOpen, setProfileOpen] = React.useState(!1);
  let [weightOpen, setWeightOpen] = React.useState(!1);
  React.useEffect(() => { if (initialAction === `weight`) { setWeightOpen(true); onActionHandled?.(); } }, [initialAction, onActionHandled]);
  let [targetsDraft, setTargetsDraft] = React.useState(
    DEFAULT_NUTRITION_TARGETS,
  );
  let [weightInput, setWeightInput] = React.useState(``);
  let [weightError, setWeightError] = React.useState(``);
  let [mealSavedToken, setMealSavedToken] = React.useState(null);
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
  let recentMeals = React.useMemo(() => {
    const seen = new Set();
    return [...records].filter(record => record.payload.kind === `meal`)
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(record => {
        const key = JSON.stringify([record.payload.name, record.payload.foods]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6);
  }, [records]);
  let savedFoods = React.useMemo(() => {
    const seen = new Set();
    return [...records].filter(record => record.payload.kind === `meal`)
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap(record => record.payload.foods)
      .filter(food => {
        const key = JSON.stringify(food);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 20);
  }, [records]);
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
      setMealSavedToken(current => ({ date: mealDate, sequence: (current?.sequence ?? 0) + 1 }));
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
  let foodGuidance = simpleFoodGuidance(selectedDate, volleyballSchedule);
  function reuseMeal(record) {
    newMealIdRef.current = newId();
    setEditingMeal(null);
    setMealDate(selectedDate);
    setMealDraft({ ...structuredClone(record.payload), source: `manual`, assumptions: ``, confidence: null });
    setDraftError(``);
  }
  function reuseFood(food) {
    if (!mealDraft) return;
    const blank = mealDraft.foods.length === 1 && !mealDraft.foods[0].name.trim();
    if (!blank && mealDraft.foods.length >= 30) return;
    setMealDraft({ ...mealDraft, foods: blank ? [structuredClone(food)] : [...mealDraft.foods, structuredClone(food)] });
  }
  async function saveWeight() {
    setWeightError(``);
    const kg = weightInput.trim() === `` ? Number.NaN : Number(weightInput.replace(`,`, `.`));
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
      setWeightError(`Enter a weight between 20 and 400 kg.`);
      return;
    }
    setSaving(!0);
    try {
      await saveNutritionRecord({ id: `weight-` + selectedDate, date: selectedDate, payload: { kind: `weight`, kg } }, todayWeightRecord?.version ?? 0);
      setWeightInput(``);
    } catch (error) {
      setWeightError(error instanceof Error ? error.message : `Couldn’t save.`);
    } finally { setSaving(!1); }
  }
  async function applyEstimatedTargets(estimate) {
    let result = NutritionTargetsSchema.safeParse({ ...targets, calories: estimate.calories, protein: estimate.protein, carbs: estimate.carbs, fat: estimate.fat });
    if (!result.success) throw new Error(`Check your target values.`);
    setSaving(!0);
    try {
      await saveNutritionRecord({ id: `targets`, date: selectedDate, payload: result.data }, targetsRecord?.version ?? 0);
    } finally { setSaving(!1); }
  }
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
      <div className="nutrition-toolbar">
        <div className="nutrition-date">
          <button className="icon-button" aria-label="Previous nutrition day" onClick={() => setSelectedDate(dateKey(addDays(new Date(selectedDate + `T12:00:00`), -1)))}><ChevronLeft size={18} /></button>
          <label><span className="sr-only">Nutrition date</span><input type="date" value={selectedDate} onChange={event => event.target.value && setSelectedDate(event.target.value)} /></label>
          <button className="icon-button" aria-label="Next nutrition day" onClick={() => setSelectedDate(dateKey(addDays(new Date(selectedDate + `T12:00:00`), 1)))}><ChevronRight size={18} /></button>
        </div>
      </div>
      <section className="nutrition-totals nutrition-daily" aria-label="Daily nutrition">
        <div className="nutrition-daily__energy">
          <span className="small-label">Calories</span>
          <div className="nutrition-daily__number"><strong>{roundNutrient(targets.calories === null ? dailyTotals.calories : Math.max(0, targets.calories - dailyTotals.calories)).toLocaleString('en-GB')}</strong><span>{targets.calories === null ? 'kcal logged' : 'kcal left'}</span></div>
          <p className="muted">{roundNutrient(dailyTotals.calories).toLocaleString('en-GB')}{targets.calories === null ? ' logged · No target set' : ` of ${targets.calories} kcal`}</p>
          {targets.calories !== null && targets.calories > 0 && <progress value={Math.min(dailyTotals.calories, targets.calories)} max={targets.calories} aria-label="Calories · kcal daily progress" />}
        </div>
        <div className="nutrition-daily__protein">
          <div><span className="small-label">Protein</span><strong>{roundNutrient(dailyTotals.protein)}<span>{targets.protein === null ? ' g logged' : ` / ${targets.protein} g`}</span></strong></div>
          {targets.protein !== null && <span className="nutrition-daily__left">{roundNutrient(Math.max(0, targets.protein - dailyTotals.protein))} g left</span>}
          {targets.protein !== null && targets.protein > 0 && <progress value={Math.min(dailyTotals.protein, targets.protein)} max={targets.protein} aria-label="Protein · g daily progress" />}
        </div>
        <div className="nutrition-daily__macros">{['carbs', 'fat'].map(key => <div key={key}><span>{key === 'carbs' ? 'Carbs' : 'Fat'}</span><strong>{roundNutrient(dailyTotals[key])}<span>{targets[key] === null ? ' g' : ` / ${targets[key]} g`}</span></strong></div>)}</div>
        {targets.calories === null && <button type="button" className="text-button" onClick={() => setProfileOpen(true)}>Set daily targets</button>}
      </section>
      <button type="button" className="btn full nutrition-log-action" onClick={addMeal}><Plus size={19} />Log meal</button>
      <MealRoutineCue date={selectedDate} mealSavedToken={mealSavedToken} onOpenRoutine={() => onOpenRoutine?.(selectedDate)} />
      <section className="nutrition-meals" aria-labelledby="nutrition-meals-heading">
        <div className="panel-heading"><h2 id="nutrition-meals-heading">Meals</h2><span className="muted">{mealsForDay.length} logged</span></div>
        {mealsForDay.length ? mealsForDay.map(record => {
          const meal = record.payload;
          const nutrients = sumNutrients(meal.foods);
          return <button type="button" className="nutrition-meal" onClick={() => { setEditingMeal(record); setMealDate(record.date); setMealDraft(structuredClone(meal)); setDraftError(``); }} key={record.id}>
            <div><strong>{meal.name}</strong><small>{meal.foods.map(food => food.name).join(', ')}</small></div>
            <div><strong>{roundNutrient(nutrients.calories)} kcal</strong><small>{roundNutrient(nutrients.protein)} g protein</small></div>
            <ChevronRight size={17} aria-hidden="true" />
          </button>;
        }) : <div className="nutrition-empty"><Utensils size={23} aria-hidden="true" /><div><strong>{loaded ? 'Your meals start here' : 'Loading your meals…'}</strong><p>Log what you eat. Build your day.</p></div></div>}
      </section>
      <div className="nutrition-tools">
        <button type="button" className="nutrition-tool-row" onClick={() => setProfileOpen(true)}><span><strong>Targets</strong><small>Your daily goals & profile</small></span><ChevronRight size={18} aria-hidden="true" /></button>
        <button type="button" className="nutrition-tool-row" onClick={() => { setWeightError(``); setWeightOpen(true); }}><span><strong>Weight check-in</strong><small>{latestWeightRecord?.payload.kind === 'weight' ? `${latestWeightRecord.payload.kg} kg · latest` : `${bodyWeight} kg · profile`}</small></span><ChevronRight size={18} aria-hidden="true" /></button>
        <details className="nutrition-simple-fuel">
          <summary><span><strong>Fuel for training</strong><small>Before & after your session</small></span><ChevronRight size={18} aria-hidden="true" /></summary>
          <div className="nutrition-fuel-content"><p><strong>Before</strong>{foodGuidance.before}</p><p><strong>After</strong>{foodGuidance.after}</p>
            {dailyGuidance?.(selectedDate)}
            <a className="text-button" href="https://www.ausport.gov.au/ais/nutrition/performance-nutrition-hq-modules" target="_blank" rel="noreferrer">Nutrition guide</a>
          </div>
        </details>
        {photoAnalysisReady && <button type="button" className="nutrition-tool-row" onClick={() => { setPhotoDialogOpen(true); setPhotoError(``); }}><span><strong>Meal photo</strong><small>Estimate, then review</small></span><Camera size={18} aria-hidden="true" /></button>}
      </div>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="app-dialog nutrition-dialog nutrition-targets-sheet">
          <DialogHeader><DialogTitle>Daily targets</DialogTitle><DialogDescription>Fuel muscle gain and volleyball.</DialogDescription></DialogHeader>
          <div className="nutrition-targets-summary"><div><span className="small-label">Your goals</span><p>{targets.calories === null ? 'No target set' : `${targets.calories} kcal · ${targets.protein ?? '–'} g protein`}</p><small className="muted">{targets.goalWeight === null ? 'Goal weight is optional' : `Goal weight: ${targets.goalWeight} kg`}</small></div><button type="button" className="text-button" onClick={() => { setTargetsDraft({ ...targets }); setDraftError(``); setProfileOpen(false); setTargetsOpen(true); }}>Edit targets</button></div>
          <NutritionCalculator profile={nutritionProfile} bodyWeight={bodyWeight} disabled={!loaded || saving || !onNutritionProfileChange} onProfileSave={onNutritionProfileChange} onApplyTargets={applyEstimatedTargets} />
        </DialogContent>
      </Dialog>
      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent className="app-dialog nutrition-dialog">
          <DialogHeader><DialogTitle>Weight check-in</DialogTitle><DialogDescription>{formatDate(selectedDate)} · Use similar conditions each time.</DialogDescription></DialogHeader>
          <label className="field-label">Body weight · kg<input type="text" inputMode="decimal" value={weightInput} placeholder={todayWeightRecord?.payload.kind === 'weight' ? String(todayWeightRecord.payload.kg) : String(bodyWeight)} onChange={event => setWeightInput(event.target.value)} /></label>
          {weightError && <p className="nutrition-error" role="alert">{weightError}</p>}
          <button type="button" className="btn full" disabled={!loaded || saving || !weightInput} onClick={() => void saveWeight()}>{saving ? 'Saving…' : 'Save weight'}</button>
          {currentWeekWeight !== null && <div className="nutrition-weight-average"><strong>{roundNutrient(currentWeekWeight)} kg</strong><span>7-day average</span>{previousWeekWeight !== null && <small>{currentWeekWeight - previousWeekWeight >= 0 ? '+' : ''}{roundNutrient(currentWeekWeight - previousWeekWeight)} kg vs last week</small>}</div>}
          <p className="small-note">Aim for 0.1–0.2 kg/week. If your average stays flat for 2–3 weeks, add 100–150 kcal/day.</p>
        </DialogContent>
      </Dialog>
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
                : `Enter values for the whole portion.`}
            </DialogDescription>
          </DialogHeader>
          {mealDraft && (
            <ReactJSX.Fragment>
              {!editingMeal && recentMeals.length > 0 && <details className="nutrition-quick-add">
                <summary>Recent meals</summary>
                <div className="nutrition-quick-add__list">{recentMeals.map(record => <button type="button" key={record.id} onClick={() => reuseMeal(record)}><span>{record.payload.name}</span><small>{roundNutrient(sumNutrients(record.payload.foods).calories)} kcal</small></button>)}</div>
              </details>}
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
                          inputMode={`decimal`}
                          onFocus={event => event.target.select()}
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
              {savedFoods.length > 0 && <details className="nutrition-quick-add">
                <summary>Saved foods</summary>
                <p className="small-note">From your food log. Check the portion before saving.</p>
                <div className="nutrition-quick-add__list">{savedFoods.map((food, index) => <button type="button" key={index} disabled={mealDraft.foods.length >= 30 && Boolean(mealDraft.foods[0].name.trim())} onClick={() => reuseFood(food)}><span>{food.name}<small>{food.portion}</small></span><small>{roundNutrient(food.calories)} kcal</small></button>)}</div>
              </details>}
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
              <details className="nutrition-quick-add nutrition-meal-details">
                <summary>Meal details</summary>
                <label className="field-label">Meal date<input type="date" value={mealDate} onChange={event => setMealDate(event.target.value)} /></label>
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
              </details>
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
