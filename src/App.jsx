import { berlinDate, calendarDayIndex } from "./calendar-date";
import { upgradeMasterProgram, restorePreviousMasterProgram } from "./master-program-upgrade";
import { WorkoutPlanPreview } from "./WorkoutPlanPreview";
import { WarmupFlow } from "./WarmupFlow";
import { findSessionDraft, getPreparationStatus, putSessionDraft, resetDraftPreparation, resolveSessionDraft } from "./workout-drafts";
import { useRestAudio } from "./useRestAudio";
import { DEFAULT_REST_VOLUME } from "./rest-audio";
import { TimerSoundSettings } from "./TimerSoundSettings";
import './workout-flow.css';
import { Search, History } from "lucide-react";
import { exercisePerformanceIdentity, areComparableExercises } from "./performance-insights";
import { WorkoutCompletion } from "./WorkoutCompletion";
import { getQuickWarmup, getSessionPreparation } from "./session-preparation";
import './session-extras.css';
import { WorkoutBuilder } from "./WorkoutBuilder";
import { WeeklyPlanTools } from "./WeeklyPlanTools";
import { WorkoutCustomizer } from "./WorkoutCustomizer";
import { PerformanceDetails } from "./PerformanceDetails";
import { AppearanceSettings } from "./ThemeSettings";
import { useAppearance } from "./theme";
import { usePerformanceData } from "./usePerformanceData";
import { resetRecommendedPlan } from "./workout-customization";
import { findLibraryExercise } from "./exercise-library";
import { getSessionPurpose } from "./training-purpose";
import { TodayView } from "./TodayView";
import { FocusedWorkout } from "./FocusedWorkout";
import { WorkoutPreview } from "./WorkoutPreview";
import { ProgressOverview } from "./ProgressOverview";
import { RemindersPanel } from "./RemindersPanel";
import { shortSessionName } from "./presentation";
import { VolleyballMasterProgram, MasterProgramReadiness } from './VolleyballMasterProgram';
import { applyMasterReadiness, createVolleyballMasterPlan, getMasterProgramWeek, getMasterProgramPhase, masterWeekStart, masterScheduledEvents, masterPlannedMinutes, resolveMasterProgramPlan, createRecommendedMasterPlan, isMasterReadinessRequired, masterJumpContacts } from './volleyball-master-plan';
import { PageHeader, BottomNavigation, SegmentedControl, MenuRow } from "./components/design";
import { House, Ellipsis, UserRound, ArrowLeft, Upload, ShieldCheck } from "lucide-react";
import { DataSettings } from "./DataSettings";
import { ExtraActivities } from "./ExtraActivities";
import { ActivityHistory } from "./ActivityHistory";
import { DailyGuidance } from "./DailyGuidance";
import { ShortRoutine } from "./ShortRoutine";
import { TrainingSchedule } from "./TrainingSchedule";
import { ActivityImport } from "./ActivityImport";
import { ExerciseGuide } from "./ExerciseGuide";
import { ExerciseLibrarySheet } from "./ExerciseLibrarySheet";
import { WeeklyPerformance } from "./WeeklyPerformance";
import { WeeklyReport } from "./WeeklyReport";
import { DecimalWeightInput } from "./DecimalWeightInput";
import { isValidWorkoutWeight } from "./workout-weight";
import { applyTimedSetAction, recordedTimedSetSeconds } from "./timed-sets";
import { estimateActivity } from "./activities";
import { requestLocal } from "./storage";
import * as React from "react";
import { toast, Toaster } from "sonner";
import { Timer } from "lucide-react";
import { Dumbbell } from "lucide-react";
import { RotateCcwClock } from "lucide-react";
import { ChartColumn } from "lucide-react";
import { Utensils } from "lucide-react";
import { ListChecks } from "lucide-react";
import { Settings2 } from "lucide-react";
import * as ReactJSX from "react/jsx-runtime";
import { CheckCheck } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Check } from "lucide-react";
import { Clock3 } from "lucide-react";
import { Play } from "lucide-react";
import { Pause } from "lucide-react";
import { Pencil } from "lucide-react";
import { Zap } from "lucide-react";
import { Flame } from "lucide-react";
import { ResponsiveContainer } from "recharts";
import { LineChart } from "recharts";
import { CartesianGrid } from "recharts";
import { XAxis } from "recharts";
import { YAxis } from "recharts";
import { Tooltip as ChartTooltip } from "recharts";
import { Line } from "recharts";
import { Plus } from "lucide-react";
import { X } from "lucide-react";
import { Activity } from "lucide-react";
import { Leaf } from "lucide-react";
import {
  DEFAULT_PROFILE,
  EXERCISE_LIBRARY,
  ProfileSchema,
  ExerciseSchema,
  SessionSchema,
  WEEKDAYS,
  addDays,
  bestMeasurement,
  completedSets,
  createSession,
  dateKey,
  elapsedTime,
  estimatedCalories,
  formatDate,
  formatDuration,
  formatElapsedTime,
  getCalories,
  measurementLabel,
  previousExercise,
  sessionDuration,
  startOfWeek,
  stopSessionTimers,
  topSet,
} from "./domain";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui";
import { NutritionView } from "./NutritionView";
async function requestTracker(payload) {
  return requestLocal("/api/tracker", payload, DEFAULT_PROFILE);
}
function GymApp({
  initialDate = berlinDate(),
  initialNow = Date.now(),
} = {}) {
  let [profile, setProfile] = React.useState(DEFAULT_PROFILE);
  let [sessions, setSessions] = React.useState([]);
  let [activityRecords, setActivityRecords] = React.useState([]);
  let [reportNutrition, setReportNutrition] = React.useState(undefined);
  let [reportNutritionError, setReportNutritionError] = React.useState(``);
  let [loaded, setLoaded] = React.useState(!1);
  useAppearance(loaded ? (profile.appearance ?? 'system') : undefined);
  const performance = usePerformanceData(loaded);
  const [exerciseActionKey, setExerciseActionKey] = React.useState(null);
  const [customBuilder, setCustomBuilder] = React.useState(null);
  const [resetPlanOpen, setResetPlanOpen] = React.useState(false);
  const [workoutChooserOpen, setWorkoutChooserOpen] = React.useState(false);
  const [performanceAction, setPerformanceAction] = React.useState(undefined);
  const [completedCelebrationId, setCompletedCelebrationId] = React.useState(null);
  let [saving, setSaving] = React.useState(!1);
  let [loadError, setLoadError] = React.useState(``);
  const [previewContext, setPreviewContext] = React.useState(null);
  const [todayActivitiesOpen, setTodayActivitiesOpen] = React.useState(false);
  const [warmupContext, setWarmupContext] = React.useState(null);
  const startingMainRef = React.useRef(false);
  const [stretchContext, setStretchContext] = React.useState(null);
  let [tab, setTabState] = React.useState(`today`);
  let [progressView, setProgressView] = React.useState(`overview`);
  let [progressReportWeek, setProgressReportWeek] = React.useState(() => dateKey(startOfWeek(new Date(`${initialDate}T12:00:00`))));
  let [moreView, setMoreView] = React.useState(`menu`);
  const setTab = React.useCallback((next) => {
    if (next === `nutrition`) { setMoreView(`nutrition`); setTabState(`more`); }
    else setTabState(next);
  }, []);
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: `instant` }); }, [tab, moreView, progressView]);
  let [routineDate, setRoutineDate] = React.useState(initialDate);
  let [nutritionAction, setNutritionAction] = React.useState(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  let [importOpen, setImportOpen] = React.useState(false);
  let [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(new Date(`${initialDate}T12:00:00`)),
  );
  let [selectedDay, setSelectedDay] = React.useState(
    () => (new Date(`${initialDate}T12:00:00`).getDay() + 6) % 7,
  );
  let [now, setNow] = React.useState(initialNow);
  const today = berlinDate(now);
  let [restEndsAt, setRestDeadline] = React.useState(null);
  const [restFinished, setRestFinished] = React.useState(null);
  function setRestEndsAt(deadline) { setRestFinished(null); setRestDeadline(deadline); }
  let [restSeconds, setRestSeconds] = React.useState(90);
  const restAudio = useRestAudio({ enabled: profile.timerSoundEnabled !== false, volume: profile.timerSoundVolume ?? DEFAULT_REST_VOLUME, endsAt: restEndsAt,
    onComplete: result => {
      setRestEndsAt(null); setNow(Date.now());
      setRestFinished({ resumed: result.resumed, needsAudioTap: !result.resumed && profile.timerSoundEnabled !== false && !result.audible });
    } });
  let [finishOpen, setFinishOpen] = React.useState(!1);
  let [finishMinutes, setFinishMinutes] = React.useState(``);
  let [watchCalories, setWatchCalories] = React.useState(``);
  let [finishSaving, setFinishSaving] = React.useState(!1);
  let [discardOpen, setDiscardOpen] = React.useState(!1);
  let [settingsOpen, setSettingsOpen] = React.useState(!1);
  let [settingsDraft, setSettingsDraft] = React.useState({
    bodyWeight: DEFAULT_PROFILE.bodyWeight,
    restSeconds: 90,
  });
  let [installOpen, setInstallOpen] = React.useState(!1);
  let [editingDay, setEditingDay] = React.useState(null);
  let [planDraft, setPlanDraft] = React.useState(null);
  let [extraSessionVisible, setExtraSessionVisible] = React.useState(!1);
  let [editingExtraSession, setEditingExtraSession] = React.useState(!1);
  let [profileSaving, setProfileSaving] = React.useState(!1);
  let [selectedHistory, setSelectedHistory] = React.useState(null);
  let [deleteCandidate, setDeleteCandidate] = React.useState(null);
  let [mutatingRecordId, setMutatingRecordId] = React.useState(null);
  let [recentlyDeletedOpen, setRecentlyDeletedOpen] = React.useState(!1);
  let [editingHistoryId, setEditingHistoryId] = React.useState(null);
  let [progressExerciseKey, setProgressExerciseKey] =
    React.useState(`chest-press`);
  let sessionsRef = React.useRef([]);
  let sessionVersionsRef = React.useRef(new Map());
  let profileVersionRef = React.useRef(0);
  let pendingWritesRef = React.useRef(new Map());
  let activeWriteRef = React.useRef(null);
  let saveTimeoutRef = React.useRef(null);
  let writeFailedRef = React.useRef(!1);
  let mountedRef = React.useRef(!0);
  let recordMutationRef = React.useRef(!1);
  async function loadWorkouts() {
    setLoadError(``);
    try {
      let e = await requestTracker();
      let t = ProfileSchema.parse(e.profile);
      let n = e.sessions.map(
        (e) => (
          sessionVersionsRef.current.set(e.session.id, e.version),
          SessionSchema.parse(e.session)
        ),
      );
      setProfile(t);
      profileVersionRef.current = e.profileVersion;
      setSessions(n);
      setActivityRecords(e.activities ?? []);
      sessionsRef.current = n;
      setLoaded(!0);
      let i = n.find((e) => e.status === `active`);
      i &&
        (setSelectedDay(i.day),
        setWeekStart(startOfWeek(new Date(`${i.date}T12:00:00`))));
      setRestSeconds(t.restSeconds);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : `Your workouts couldn’t load.`,
      );
    }
  }
  async function flushPendingWrites() {
    if (
      ((saveTimeoutRef.current &&=
        (clearTimeout(saveTimeoutRef.current), null)),
      activeWriteRef.current)
    )
      return (
        await activeWriteRef.current,
        pendingWritesRef.current.size && !writeFailedRef.current
          ? flushPendingWrites()
          : !writeFailedRef.current
      );
    if (!pendingWritesRef.current.size) return !writeFailedRef.current;
    setSaving(!0);
    writeFailedRef.current = !1;
    let e = (async () => {
      for (; pendingWritesRef.current.size;) {
        let [e, t] = pendingWritesRef.current.entries().next().value;
        pendingWritesRef.current.delete(e);
        try {
          let n = await requestTracker({
            action: `session`,
            session: t,
            expectedVersion: sessionVersionsRef.current.get(e) ?? 0,
          });
          sessionVersionsRef.current.set(e, n.version);
        } catch (n) {
          return (
            pendingWritesRef.current.has(e) ||
              pendingWritesRef.current.set(e, t),
            (writeFailedRef.current = !0),
            mountedRef.current &&
              setLoadError(
                n instanceof Error ? n.message : `Your workout couldn’t save.`,
              ),
            !1
          );
        }
      }
      return (mountedRef.current && setLoadError(``), !0);
    })();
    activeWriteRef.current = e;
    let t = await e;
    return (
      (activeWriteRef.current = null),
      mountedRef.current && setSaving(!1),
      t
    );
  }
  async function replaceLocalData(replace) {
    await flushPendingWrites();
    // A confirmed restore/reset must not be overwritten by the unload flush.
    const queued = new Map(pendingWritesRef.current);
    pendingWritesRef.current.clear();
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    try {
      replace();
      window.location.reload();
    } catch (error) {
      for (const [id, session] of queued) pendingWritesRef.current.set(id, session);
      if (queued.size) saveTimeoutRef.current = setTimeout(() => void flushPendingWrites(), 450);
      throw error;
    }
  }
  function queueSession(e, t = !1) {
    sessionsRef.current = [
      e,
      ...sessionsRef.current.filter((t) => t.id !== e.id),
    ];
    setSessions(sessionsRef.current);
    pendingWritesRef.current.set(e.id, e);
    setSaving(!0);
    saveTimeoutRef.current && clearTimeout(saveTimeoutRef.current);
    t
      ? flushPendingWrites()
      : (saveTimeoutRef.current = setTimeout(
          () => void flushPendingWrites(),
          450,
        ));
  }
  let activeSession = sessions.find((e) => e.status === `active`);
  let viewingSession = editingHistoryId
    ? sessions.find((e) => e.id === editingHistoryId)
    : activeSession;
  let selectedDate = dateKey(addDays(weekStart, selectedDay));
  function planForDate(date) {
    if (!profile.masterProgram) return profile.plan;
    if (date < profile.masterProgram.startDate) return profile.preMasterPlan ?? profile.plan;
    return resolveMasterProgramPlan(profile.plan, profile.masterProgram, date, profile.masterMatchWeekend);
  }
  let scheduledPlan = React.useMemo(() => planForDate(selectedDate), [profile.plan, profile.masterProgram, profile.preMasterPlan, profile.masterMatchWeekend, selectedDate]);
  let currentWeekPlan = React.useMemo(() => planForDate(today), [profile.plan, profile.masterProgram, profile.preMasterPlan, profile.masterMatchWeekend, today]);
  let masterWeek = profile.masterProgram && getMasterProgramWeek(profile.masterProgram.startDate, selectedDate);
  let selectedMasterMatch = !!masterWeek && profile.masterProgram.matchWeeks.includes(masterWeek);
  let editableWeekPlan = selectedMasterMatch ? [...profile.plan.slice(0, 5), ...(profile.masterMatchWeekend ?? createVolleyballMasterPlan(true).slice(5))] : profile.plan;
  let dayEvents = masterScheduledEvents(profile.masterProgram, selectedDate);
  // A date and slot travel with every plan action. Neither browsing Train nor
  // midnight can retarget an open preview, preparation, or active session.
  function workoutForDate(date, requestedSlot = 'main') {
    const day = calendarDayIndex(date);
    const week = date === selectedDate ? scheduledPlan : date === today ? currentWeekPlan : planForDate(date);
    const slot = requestedSlot === 'extra' && week[day].extraSession ? 'extra' : 'main';
    const recommended = slot === 'extra' ? week[day].extraSession : week[day];
    const draft = findSessionDraft(profile.sessionDrafts, date, slot);
    const masterWeek = profile.masterProgram && getMasterProgramWeek(profile.masterProgram.startDate, date);
    const readiness = masterWeek ? profile.masterProgram.readiness?.find(row => row.date === date)?.status : undefined;
    const resolved = resolveSessionDraft(draft, recommended);
    const plan = draft && draft.customized !== false && draft.readiness !== readiness
      ? applyMasterReadiness(resolved, readiness) : resolved;
    const warmupIsCurrent = draft && (draft.customized !== false || resolved !== recommended) && draft.readiness === readiness;
    return { date, day, slot, plan, draft, masterWeek, warmupIsCurrent };
  }
  const selectedContext = workoutForDate(selectedDate, extraSessionVisible ? 'extra' : 'main');
  const { plan: selectedPlan, slot: selectedSlot } = selectedContext;
  const todayContext = workoutForDate(today);
  const todayMasterWeek = todayContext.masterWeek;
  const masterBlockComplete = !!profile.masterProgram && !todayMasterWeek && today >= profile.masterProgram.startDate;
  const previewWorkout = previewContext ? workoutForDate(previewContext.date, previewContext.slot) : selectedContext;
  const preparationDraft = warmupContext && findSessionDraft(profile.sessionDrafts, warmupContext.date, warmupContext.slot);
  const warmupPlan = preparationDraft?.plan ?? (warmupContext ? workoutForDate(warmupContext.date, warmupContext.slot).plan : selectedPlan);
  const gateWarmupItems = preparationFor(warmupPlan, 'warmup');
  let completedSessions = sessions
    .filter((e) => e.status === `completed`)
    .sort((e, t) => t.date.localeCompare(e.date) || t.startedAt - e.startedAt);
  let deletedSessions = sessions
    .filter((e) => e.status === `deleted`)
    .sort((e, t) => (t.deletedAt ?? 0) - (e.deletedAt ?? 0));
  let dayCompletedSession = completedSessions.find(
    (e) => e.date === selectedDate,
  );
  const todayCompletedSession = completedSessions.find(session => session.date === today);
  let weekCompletedSessions = completedSessions.filter(
    (e) =>
      e.date >= dateKey(weekStart) && e.date <= dateKey(addDays(weekStart, 6)),
  );
  let currentSession = viewingSession;
  const stretchSession = stretchContext?.sessionId ? sessions.find(session => session.id === stretchContext.sessionId) : null;
  const preparationSource = currentSession ?? selectedPlan;
  const warmupItems = preparationFor(preparationSource, 'warmup');
  const cooldownItems = preparationFor(preparationSource, 'cooldown');
  const stretchItems = preparationFor(stretchSession ?? stretchContext?.plan ?? selectedPlan, 'cooldown');
  const stretchDescription = stretchSession?.kind === 'strength' && stretchSession.status === 'completed' && !completedSets(stretchSession)
    ? 'No sets logged. Based on your planned session.'
    : stretchSession?.kind === 'recovery' ? 'Easy movement for your recovery day.'
      : stretchSession?.kind === 'sport' ? 'Gentle mobility after court time.'
        : stretchSession && completedSets(stretchSession) > 0 ? 'Stretches matched to the movements you logged.'
          : 'Stretches for this session, after training.';
  function openStretches(session = currentSession ?? dayCompletedSession) {
    setSelectedHistory(null);
    setStretchContext({ sessionId: session?.id ?? null, plan: session ? null : selectedPlan });
  }
  React.useLayoutEffect(() => {
    // Enter a newly started/restored session at its heading. Browser scroll
    // anchoring can otherwise follow the removed overview on a short screen.
    if (tab === `train`) window.scrollTo({ top: 0, behavior: `instant` });
  }, [currentSession?.id]);
  let workoutDate = currentSession?.date ?? selectedDate;
  let weekActivities = activityRecords.filter(({ activity }) =>
    activity.deletedAt === null && activity.date >= dateKey(weekStart) &&
    activity.date <= dateKey(addDays(weekStart, 6)),
  );
  let reportWeekActivities = activityRecords.filter(({ activity }) =>
    activity.deletedAt === null && activity.date >= progressReportWeek &&
    activity.date <= dateKey(addDays(new Date(`${progressReportWeek}T12:00:00`), 6)),
  );
  let extraWeekCalories = weekActivities.reduce((sum, { activity }) => sum + estimateActivity(activity).calories, 0);
  let extraWeekMinutes = weekActivities.reduce((sum, { activity }) => sum + activity.durationMinutes, 0);
  let reportExtraMinutes = reportWeekActivities.reduce((sum, { activity }) => sum + activity.durationMinutes, 0);
  let reportExtraCalories = reportWeekActivities.reduce((sum, { activity }) => sum + estimateActivity(activity).calories, 0);
  async function saveExtraActivity(activity, expectedVersion) {
    if (!(await flushPendingWrites())) {
      throw new Error(`Save your workout changes before updating extra activities.`);
    }
    const saved = await requestTracker({ action: `activity`, activity, expectedVersion });
    setActivityRecords((records) => [
      { activity, version: saved.version },
      ...records.filter((record) => record.activity.id !== activity.id),
    ]);
  }
  async function importExtraActivities(activities) {
    if (!(await flushPendingWrites())) {
      throw new Error(`Save your workout changes before importing activities.`);
    }
    const saved = await requestTracker({ action: `activity-batch`, activities });
    setActivityRecords((records) => [...saved.activities, ...records]);
  }
  function dailyContext(date) {
    const planDay = planForDate(date)[(new Date(`${date}T12:00:00`).getDay() + 6) % 7];
    const dailyActivities = activityRecords.filter(({ activity }) => activity.date === date && activity.deletedAt === null).map(({ activity }) => activity);
    const daySessions = sessions.filter((session) => session.date === date && [`active`, `completed`].includes(session.status));
    const trainingMinutes = daySessions.reduce((sum, session) => sum + sessionDuration(session, now) / 6e4, 0);
    const totalMinutes = trainingMinutes + dailyActivities.reduce((sum, activity) => sum + activity.durationMinutes, 0);
    const totalCalories = daySessions.reduce((sum, session) => sum + getCalories(session, now), 0) + dailyActivities.reduce((sum, activity) => sum + estimateActivity(activity).calories, 0);
    return { input: { date, bodyWeightKg: profile.bodyWeight,
      plannedKind: planDay.kind, plannedName: masterScheduledEvents(profile.masterProgram, date).some(event => event.name === 'School PE') ? 'School PE + Volleyball' : planDay.name,
      plannedTrainingMinutes: masterPlannedMinutes(profile.masterProgram, date, planDay.minutes, dailyActivities),
      extraActivities: dailyActivities, completedTrainingMinutes: trainingMinutes,
    }, minutes: totalMinutes, calories: totalCalories };
  }
  function guidanceForDate(date, includeRoutine = true) {
    return <DailyGuidance {...dailyContext(date)} includeRoutine={includeRoutine} />;
  }
  const selectedWorkingExercises = selectedPlan.exercises.filter(exercise => exercise.optionalWork !== true);
  const loggedJumpContacts = currentSession?.programRevision === '8.1' ? masterJumpContacts(currentSession, currentSession) : null;
  let totalSets =
    currentSession?.exercises.reduce((e, t) => e + t.logs.length, 0) ??
    selectedWorkingExercises.reduce((e, t) => e + t.sets, 0);
  let doneSets = currentSession ? completedSets(currentSession) : 0;
  let restRemaining = restEndsAt === null ? 0 : Math.max(0, restEndsAt - now);
  function updateSession(e) {
    let t = sessionsRef.current.find(
      (e) => e.id === (editingHistoryId ?? activeSession?.id),
    );
    t && queueSession(e(t));
  }
  function editPlanDay(e, t = !1) {
    setEditingExtraSession(t);
    setEditingDay(e);
    setPlanDraft(
      structuredClone(t ? editableWeekPlan[e].extraSession : editableWeekPlan[e]),
    );
  }
  React.useEffect(() => setExtraSessionVisible(!1), [selectedDay, weekStart]);
  function updateExercise(e, t) {
    updateSession((n) => ({
      ...n,
      exercises: n.exercises.map((n) => (n.key === e ? t(n) : n)),
    }));
  }
  function togglePreparation(e, t, n) {
    updateSession((r) => ({
      ...r,
      [e]: preparationFor(r, e).map((e) =>
        e.key === t
          ? {
              ...e,
              done: n,
            }
          : e,
      ),
    }));
  }
  async function changeSessionStatus(e, t) {
    if (recordMutationRef.current) {
      toast(`Wait for the current record to finish saving.`);
      return;
    }
    recordMutationRef.current = !0;
    setMutatingRecordId(e);
    try {
      if (!(await flushPendingWrites())) return;
      let n = sessionsRef.current.find((t) => t.id === e);
      if (
        !n ||
        (t === `deleted` ? n.status !== `completed` : n.status !== `deleted`)
      )
        return;
      let r = SessionSchema.parse({
        ...n,
        status: t,
        deletedAt: t === `deleted` ? Date.now() : null,
      });
      let i = await requestTracker({
        action: `session`,
        session: r,
        expectedVersion: sessionVersionsRef.current.get(e) ?? 0,
      });
      sessionVersionsRef.current.set(e, i.version);
      sessionsRef.current = sessionsRef.current.map((t) =>
        t.id === e ? r : t,
      );
      setSessions(sessionsRef.current);
      editingHistoryId === e && setEditingHistoryId(null);
      selectedHistory?.id === e && setSelectedHistory(null);
      setDeleteCandidate(null);
      t === `deleted`
        ? toast.success(`Workout deleted.`, {
            action: {
              label: `Undo`,
              onClick: () => void changeSessionStatus(e, `completed`),
            },
          })
        : toast.success(`Workout restored.`);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : `Your record could not be updated. Try again.`,
      );
    } finally {
      recordMutationRef.current = !1;
      setMutatingRecordId(null);
    }
  }
  function updateSet(e, t, n, manualTime = !1) {
    updateExercise(e, (e) => ({
      ...e,
      ...(manualTime && Object.hasOwn(n, `seconds`) && e.timerSetId === t
        ? { timerSetId: null, elapsedMs: 0, runningSince: null } : {}),
      logs: e.logs.map((r) => {
        if (r.id !== t) return r;
        let i = {
          ...r,
          ...n,
        };
        return (
          i.done &&
            (e.mode === `timed` ? !(i.seconds ?? 0) : !(i.reps ?? 0)) &&
            (i.done = !1),
          i.done && e.mode === `weight` && !isValidWorkoutWeight(i.kg) && (i.done = !1),
          i
        );
      }),
    }));
  }
  async function saveDayDraft(plan, { date = selectedDate, slot = selectedSlot, override = false,
    customized = findSessionDraft(profile.sessionDrafts, date, slot)?.customized ?? !!findSessionDraft(profile.sessionDrafts, date, slot) } = {}) {
    if (!loaded || loadError || profileSaving) return false;
    return saveProfile({ ...profile, sessionDrafts: putSessionDraft(profile.sessionDrafts,
      { date, slot, plan, warmupOverride: override, customized, readiness: profile.masterProgram?.readiness?.find(row => row.date === date)?.status }) }, { notify: false });
  }
  function selectTrainingDate(date) {
    setWeekStart(startOfWeek(new Date(`${date}T12:00:00`)));
    setSelectedDay(calendarDayIndex(date));
    setExtraSessionVisible(false);
    setEditingHistoryId(null);
  }
  function openPreview(context = selectedContext) {
    setPreviewContext({ date: context.date, slot: context.slot });
  }
  async function startWorkout(context = selectedContext) {
    void restAudio.unlock();
    if (!loaded || activeSession || profileSaving || pendingWritesRef.current.size || activeWriteRef.current) return;
    if (profile.masterProgram?.revision === '8.1' && context.plan.programRevision === '8.1'
      && !context.masterWeek && context.date >= profile.masterProgram.startDate && !context.draft?.customized) {
      setPreviewContext(null); openProgramConfiguration();
      toast('Block complete. Choose your next block before restarting.'); return;
    }
    if (isMasterReadinessRequired(profile.masterProgram, context.date, context.plan) && !profile.masterProgram.readiness?.some(row => row.date === context.date)) {
      setPreviewContext(null); selectTrainingDate(context.date); setTab('train');
      requestAnimationFrame(() => document.querySelector('.master-readiness')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      toast('Check readiness during your warm-up first.'); return;
    }
    if (!context.plan.exercises.some(exercise => exercise.optionalWork !== true) && context.plan.kind !== 'recovery') {
      toast.error('Add an exercise to this day before starting.'); return;
    }
    const plan = { ...context.plan, warmup: preparationFor(context.plan, 'warmup').map(step => ({ ...step, done: context.warmupIsCurrent ? step.done : false })) };
    if (!(await saveDayDraft(plan, { date: context.date, slot: context.slot,
      override: context.warmupIsCurrent && context.draft.warmupOverride === true }))) return;
    setPreviewContext(null);
    setWarmupContext({ date: context.date, day: context.day, slot: context.slot });
  }
  async function startMainWorkout() {
    void restAudio.unlock();
    if (!warmupContext || !preparationDraft || activeSession || startingMainRef.current || profileSaving) return;
    startingMainRef.current = true;
    try {
      if (!(await flushPendingWrites()) || sessionsRef.current.some(session => session.status === 'active')) return;
      const session = createSession({ ...warmupPlan, cooldown: preparationFor(warmupPlan, 'cooldown') },
        warmupContext.day, warmupContext.date, profile, sessionsRef.current);
      session.warmup = gateWarmupItems.map(step => ({ ...step }));
      const quickSteps = getQuickWarmup(warmupPlan, gateWarmupItems);
      session.warmupOverride = preparationDraft.warmupOverride === true;
      session.warmupStatus = getPreparationStatus(quickSteps, session.warmupOverride);
      if (session.warmupStatus !== 'not-recorded') session.warmupCompletedAt = Date.now();
      // A weight deliberately planned for this date takes precedence over the
      // previous-session suggestion used by createSession.
      session.exercises = session.exercises.map(exercise => exercise.defaultKg == null ? exercise : {
        ...exercise, logs: exercise.logs.map(log => ({ ...log, kg: exercise.defaultKg })),
      });
      queueSession(SessionSchema.parse(session), true);
      if (!(await flushPendingWrites())) return;
      // Keep the date-specific prescription, but do not reuse this warm-up for another session.
      const next = resetDraftPreparation(preparationDraft);
      if (next.customized === false) {
        await saveProfile({ ...profile, sessionDrafts: (profile.sessionDrafts ?? []).filter(draft => draft.date !== next.date || draft.slot !== next.slot) }, { notify: false });
      } else await saveDayDraft(next.plan, { date: next.date, slot: next.slot });
      selectTrainingDate(warmupContext.date);
      setWarmupContext(null); setTab('train'); setEditingHistoryId(null);
    } finally { startingMainRef.current = false; }
  }
  function toggleWorkoutTimer() {
    activeSession &&
      (activeSession.runningSince === null
        ? queueSession(
            {
              ...activeSession,
              runningSince: Date.now(),
            },
            !0,
          )
        : (queueSession(stopSessionTimers(activeSession, `active`), !0),
          setRestEndsAt(null)));
  }
  function toggleMovementTimer(e, options, keepRest = !1) {
    if (!activeSession || editingHistoryId) return;
    const latest = sessionsRef.current.find(session => session.id === activeSession.id);
    if (!latest || latest.status !== `active`) return;
    let t = Date.now();
    if (options) {
      const exercise = latest.exercises.find(entry => entry.key === e);
      if (!exercise || exercise.mode !== `timed`) return;
      const updated = applyTimedSetAction(exercise, options, t);
      if (updated === exercise) return;
      queueSession({
        ...latest,
        runningSince: options.action === `start` ? latest.runningSince ?? t : latest.runningSince,
        exercises: latest.exercises.map(entry => entry.key === e ? updated
          : options.action === `start` ? { ...entry, elapsedMs: elapsedTime(entry.elapsedMs, entry.runningSince, t), runningSince: null } : entry),
      }, !0);
      if (options.action === `start` && !keepRest) setRestEndsAt(null);
      return;
    }
    queueSession(
      {
        ...latest,
        runningSince: latest.runningSince ?? t,
        exercises: latest.exercises.map((n) =>
          n.key === e
            ? {
                ...n,
                elapsedMs: elapsedTime(n.elapsedMs, n.runningSince, t),
                runningSince: n.runningSince === null ? t : null,
              }
            : {
                ...n,
                elapsedMs: elapsedTime(n.elapsedMs, n.runningSince, t),
                runningSince: null,
              },
        ),
      },
      !0,
    );
  }
  function toggleSetStopwatch(key) {
    const latest = sessionsRef.current.find(session => session.id === activeSession?.id);
    const exercise = latest?.exercises.find(entry => entry.key === key);
    if (!exercise || editingHistoryId) return;
    if (exercise.mode !== `timed` || (exercise.runningSince !== null && !exercise.timerSetId)) {
      toggleMovementTimer(key);
      return;
    }
    const set = exercise.runningSince !== null
      ? exercise.logs.find(log => log.id === exercise.timerSetId) : exercise.logs.find(log => !log.done);
    if (set) toggleMovementTimer(key, { action: exercise.runningSince === null ? `start` : `pause`, setId: set.id }, !0);
  }
  function markSetDone(e, t, n) {
    if (n && !editingHistoryId) void restAudio.unlock();
    let r = sessionsRef.current.find(
      (e) => e.id === (editingHistoryId ?? activeSession?.id),
    );
    if (!r) return;
    let i = r.exercises.find((t) => t.key === e);
    let a = i.logs.find((e) => e.id === t);
    let o = i.mode === `timed` ? (editingHistoryId ? a.seconds : recordedTimedSetSeconds(i, a, Date.now())) :
      (i.runningSince === null
        ? null
        : Math.max(1, Math.round((Date.now() - i.runningSince) / 1e3))) ??
      a.seconds;
    if (n && (i.mode === `timed` ? !o : !a.reps)) {
      toast.error(
        i.mode === `timed`
          ? `Enter a time, or run the movement timer first.`
          : `Enter your reps before checking off this set.`,
      );
      return;
    }
    if (n && i.mode === `weight` && !isValidWorkoutWeight(a.kg)) {
      toast.error(`Enter the weight you used. Use 0 for no added weight.`);
      return;
    }
    if (n && a.kg !== null && !isValidWorkoutWeight(a.kg)) {
      toast.error(`Enter a weight between 0 and 2,000 kg.`);
      return;
    }
    let s = Date.now();
    queueSession(
      {
        ...r,
        exercises: r.exercises.map((r) =>
          r.key === e
            ? {
                ...r,
                elapsedMs: n
                  ? elapsedTime(r.elapsedMs, r.runningSince, s)
                  : r.elapsedMs,
                runningSince: n ? null : r.runningSince,
                logs: r.logs.map((e) =>
                  e.id === t
                    ? {
                        ...e,
                        done: n,
                        seconds: n ? o : e.seconds,
                      }
                    : e,
                ),
              }
            : r,
        ),
      },
      !0,
    );
    n &&
      r.status === `active` &&
      i.rest > 0 &&
      (setRestSeconds(i.rest), setRestEndsAt(s + i.rest * 1e3));
  }
  async function finishWorkout() {
    if (!activeSession || finishSaving) return;
    let e = Number(finishMinutes);
    if (!Number.isFinite(e) || e <= 0 || e > 10080) {
      toast.error(`Enter a duration greater than zero.`);
      return;
    }
    let t = watchCalories.trim() === `` ? null : Number(watchCalories);
    if (t !== null && (!Number.isFinite(t) || t < 0 || t > 2e4)) {
      toast.error(`Check the calorie value.`);
      return;
    }
    setFinishSaving(!0);
    let n = {
      ...stopSessionTimers(activeSession, `completed`),
      elapsedMs: Math.round(e * 6e4),
      watchCalories: t,
    };
    queueSession(n);
    let r = await flushPendingWrites();
    setFinishSaving(!1);
    setFinishOpen(!1);
    setRestEndsAt(null);
    r && (setCompletedCelebrationId(n.id), setSelectedHistory(n));
  }
  async function saveProfile(e, { notify = true } = {}) {
    let t = ProfileSchema.safeParse(e);
    if (!t.success)
      return (
        toast.error(`Check the names, sets, and numbers in your plan.`),
        !1
      );
    if (profileSaving) return !1;
    setProfileSaving(!0);
    try {
      return (
        (profileVersionRef.current = (
          await requestTracker({
            action: `profile`,
            profile: t.data,
            expectedVersion: profileVersionRef.current,
          })
        ).version),
        setProfile(t.data),
        setRestSeconds(e.restSeconds),
        notify && toast.success(`Changes saved.`),
        !0
      );
    } catch (e) {
      return (
        toast.error(
          e instanceof Error ? e.message : `Your changes couldn’t save.`,
        ),
        !1
      );
    } finally {
      setProfileSaving(!1);
    }
  }
  function openCustomWorkout(workout = null, day = undefined) {
    setCustomBuilder({ workout: workout ? structuredClone(workout) : null, id: workout?.id, day });
  }
  function saveCurrentAsWorkout() {
    if (!currentSession) return;
    const workout = {
      name: currentSession.name, kind: currentSession.kind,
      ...(currentSession.goal ? { goal: currentSession.goal } : {}),
      minutes: currentSession.plannedMinutes ?? selectedPlan.minutes, note: currentSession.notes.slice(0, 500),
      exercises: currentSession.exercises.map(exercise => ExerciseSchema.parse({
        ...exercise, sets: Math.max(1, Math.min(20, exercise.logs.length)),
        ...(exercise.logs.find(log => log.done && log.kg !== null) ? { defaultKg: exercise.logs.filter(log => log.done && log.kg !== null).at(-1).kg } : {}),
      })),
      ...(currentSession.warmup ? { warmup: currentSession.warmup } : {}),
      ...(currentSession.cooldown ? { cooldown: currentSession.cooldown } : {}),
    };
    setCustomBuilder({ workout, id: undefined, day: undefined });
  }
  async function saveCustomWorkout(workout) {
    if (!customBuilder) return false;
    const template = { ...workout, id: customBuilder.id ?? crypto.randomUUID() };
    const existing = profile.customWorkouts ?? [];
    const customWorkouts = existing.some(item => item.id === template.id)
      ? existing.map(item => item.id === template.id ? template : item) : [...existing, template];
    const plan = customBuilder.day === undefined ? editableWeekPlan : editableWeekPlan.map((item, index) => index === customBuilder.day
      ? { ...workout, ...(item.extraSession ? { extraSession: item.extraSession } : {}) } : item);
    const saved = await saveBaseWeek(plan, { customWorkouts });
    if (saved) setCustomBuilder(null);
    return saved;
  }
  async function saveMasterProgram(settings) {
    if (settings && !profile.masterProgram) {
      const saved = await saveProfile({ ...profile, preMasterPlan: structuredClone(profile.plan),
        plan: createVolleyballMasterPlan(), masterMatchWeekend: createVolleyballMasterPlan(true).slice(5), masterProgram: settings });
      if (saved) { setWeekStart(new Date(`${settings.startDate}T12:00:00`)); setSelectedDay(0); setExtraSessionVisible(false); }
      return saved;
    }
    if (settings) return saveProfile({ ...profile, masterProgram: settings }, { notify: false });
    const { masterProgram, preMasterPlan, masterMatchWeekend, ...savedProfile } = profile;
    return saveProfile({ ...savedProfile, plan: preMasterPlan ?? profile.plan });
  }
  async function upgradeProgram() {
    if (!(await flushPendingWrites())) return false;
    const saved = await saveProfile(upgradeMasterProgram(profile), { notify: false });
    if (saved) toast.success('V8.1 ready. Your cycle and workout records stay.');
    return saved;
  }
  async function restorePreviousProgram() {
    if (!(await flushPendingWrites())) return false;
    const saved = await saveProfile(restorePreviousMasterProgram(profile), { notify: false });
    if (saved) toast.success('Previous program restored.');
    return saved;
  }
  function saveBaseWeek(plan, updates = {}) {
    if (!profile.masterProgram || !selectedMasterMatch) return saveProfile({ ...profile, ...updates, plan });
    return saveProfile({ ...profile, ...updates, plan: profile.plan.map((day, index) => index < 5 ? plan[index] : day), masterMatchWeekend: plan.slice(5) });
  }
  async function startCustomWorkout(template) {
    void restAudio.unlock();
    if (activeSession || editingHistoryId) { toast('Finish your current workout first.'); return; }
    if (!(await flushPendingWrites())) return;
    const { id: _id, ...workout } = template;
    const plan = { ...workout, warmup: preparationFor(workout, 'warmup').map(step => ({ ...step, done: false })) };
    if (!(await saveDayDraft(plan, { customized: true }))) return;
    setWorkoutChooserOpen(false);
    setWarmupContext({ date: selectedDate, day: selectedDay, slot: selectedSlot });
  }
  async function customizeSession(next) {
    queueSession(SessionSchema.parse(next), true);
    if (!(await flushPendingWrites())) throw new Error('Your workout could not save. Retry before making another change.');
  }
  async function saveNutritionProfile(values) {
    const { bodyWeightKg, ...nutrition } = values;
    if (!(await saveProfile({ ...profile, bodyWeight: bodyWeightKg, nutrition }))) {
      throw new Error(`Your nutrition profile could not be saved. Check the values or reload and retry.`);
    }
    return true;
  }
  const volleyballSchedule = profile.volleyballSchedule ?? DEFAULT_PROFILE.volleyballSchedule;
  async function saveVolleyballSchedule(schedule) {
    const plan = profile.plan.map((day, index) => schedule.days.includes(index)
      ? { ...day, note: day.note.replace(/\b\d{2}:\d{2}[–-]\d{2}:\d{2}/g,
        `${schedule.startTime}–${schedule.endTime}`) }
      : day);
    if (!(await saveProfile({ ...profile, plan, volleyballSchedule: schedule }))) {
      throw new Error(`Your training times could not be saved. Reload and retry.`);
    }
  }
  let actionsRef = React.useRef({
    start: startWorkout,
    flush: flushPendingWrites,
    changeExercise: updateExercise,
  });
  actionsRef.current = {
    start: startWorkout,
    flush: flushPendingWrites,
    changeExercise: updateExercise,
  };
  let trainingStateRef = React.useRef({
    sessions: sessions,
    profile: profile,
    loaded: loaded,
    day: selectedDay,
    selectedDate: selectedDate,
  });
  trainingStateRef.current = {
    sessions: sessions,
    profile: profile,
    loaded: loaded,
    day: selectedDay,
    selectedDate: selectedDate,
  };
  React.useEffect(() => {
    mountedRef.current = !0;
    loadWorkouts();
    setNow(Date.now());
    let t = setInterval(() => setNow(Date.now()), 1e3);
    let n = (e) => {
      (pendingWritesRef.current.size || activeWriteRef.current) &&
        (e.preventDefault(), (e.returnValue = ``));
    };
    let r = () => {
      setNow(Date.now());
      document.visibilityState === `hidden` && actionsRef.current.flush();
    };
    return (
      window.addEventListener(`beforeunload`, n),
      document.addEventListener(`visibilitychange`, r),
      window.addEventListener(`pageshow`, r),
      window.addEventListener(`focus`, r),
      () => {
        mountedRef.current = !1;
        clearInterval(t);
        window.removeEventListener(`beforeunload`, n);
        document.removeEventListener(`visibilitychange`, r);
        window.removeEventListener(`pageshow`, r);
        window.removeEventListener(`focus`, r);
        saveTimeoutRef.current && clearTimeout(saveTimeoutRef.current);
      }
    );
  }, []);
  async function loadReportNutrition() {
    try {
      const saved = await requestLocal(`/api/nutrition`);
      setReportNutrition(saved.records);
      setReportNutritionError(``);
    } catch (error) {
      setReportNutrition(undefined);
      setReportNutritionError(error instanceof Error ? error.message : `Nutrition logs could not load.`);
    }
  }
  React.useEffect(() => {
    if (loaded && [`today`, `progress`].includes(tab)) void loadReportNutrition();
  }, [tab, loaded, today]);
  void 0;
  let allExercises = Array.from(
    new Map(
      [
        ...completedSessions.flatMap((e) => e.exercises),
        ...profile.plan.flatMap((e) => [
          ...e.exercises,
          ...(e.extraSession?.exercises ?? []),
        ]),
      ].map((e) => [exercisePerformanceIdentity(e), e]),
    ).values(),
  );
  let progressExercise =
    allExercises.find((e) => exercisePerformanceIdentity(e) === progressExerciseKey || (e.exerciseId ?? e.key) === progressExerciseKey) ?? allExercises[0];
  let exerciseSessions = completedSessions
    .filter((e) =>
      e.exercises.some(
        (e) => progressExercise && areComparableExercises(e, progressExercise) && e.logs.some((e) => e.done),
      ),
    )
    .reverse();
  let chartData = exerciseSessions
    .slice(-12)
    .filter(
      (e) =>
        !progressExercise?.measurement ||
        bestMeasurement(
          e.exercises.find((e) => areComparableExercises(e, progressExercise)),
        ) !== null,
    )
    .map((e) => {
      let t = e.exercises.find((e) => areComparableExercises(e, progressExercise));
      return {
        date: formatDate(e.date, !0),
        value: progressExercise.measurement
          ? bestMeasurement(t)
          : progressExercise.mode === `weight`
            ? (topSet(t)?.kg ?? 0)
            : progressExercise.mode === `timed`
              ? t.logs
                  .filter((e) => e.done)
                  .reduce((e, t) => e + (t.seconds ?? 0), 0)
              : t.logs
                  .filter((e) => e.done)
                  .reduce((e, t) => e + (t.reps ?? 0), 0),
      };
    });
  let chartMetricLabel = progressExercise?.measurement
    ? measurementLabel(progressExercise)
    : progressExercise?.mode === `weight`
      ? `Top weight · kg`
      : progressExercise?.mode === `timed`
        ? `Total time · sec`
        : `Total reps`;
  function comparablePrevious(exercise, date, excludedId) {
    const previous = previousExercise(completedSessions, exercise.exerciseId ?? exercise.key, date, excludedId);
    return previous && areComparableExercises(previous.exercise, exercise) ? previous : null;
  }
  function volleyballIsSoon() {
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now));
    const [hour, minute] = clock.split(':').map(Number);
    const [startHour, startMinute] = volleyballSchedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = volleyballSchedule.endTime.split(':').map(Number);
    const day = (new Date(`${today}T12:00:00`).getDay() + 6) % 7;
    const currentMinutes = hour * 60 + minute;
    return [0, 1].some(offset => volleyballSchedule.days.includes((day + offset) % 7)
      && offset * 1440 + startHour * 60 + startMinute - currentMinutes <= 1440
      && offset * 1440 + endHour * 60 + endMinute - currentMinutes >= 0);
  }
  function openPlan() { setMoreView(`plan`); setTab(`more`); }
  function openProgramConfiguration() {
    openPlan();
    requestAnimationFrame(() => {
      const options = document.querySelector('.native-program-options');
      if (options) { options.open = true; options.scrollIntoView({ block: 'start' }); }
    });
  }
  function openSettings() {
    setSettingsDraft({ bodyWeight: profile.bodyWeight, restSeconds: profile.restSeconds });
    setSettingsOpen(true);
  }
  const weekSelector = <div className="compact-week">
          <div className={`week-heading`}>
            <div className={`week-control`}>
              <button
                className={`icon-button`}
                aria-label={`Previous week`}
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                {formatDate(dateKey(weekStart), !0)}
                {` – `}
                {formatDate(dateKey(addDays(weekStart, 6)), !0)}
              </span>
              <button
                className={`icon-button`}
                aria-label={`Next week`}
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              className={`text-button`}
              onClick={() => {
                selectTrainingDate(berlinDate());
              }}
            >{`Today`}</button>
          </div>
          <div className={`week-strip`} aria-label={`Choose a training day`}>
            {scheduledPlan.map((e, t) => {
              let n = dateKey(addDays(weekStart, t));
              let r = completedSessions.some((e) => e.date === n);
              let i = currentSession
                ? currentSession.date === n
                : selectedDay === t;
              return (
                <button
                  className={`day-cell ${i ? `selected` : ``} ${n === today ? `today` : ``}`}
                  aria-pressed={i}
                  onClick={() => {
                    if (activeSession) {
                      toast(
                        `Finish your current workout before choosing another day.`,
                      );
                      return;
                    }
                    setSelectedDay(t);
                    setEditingHistoryId(null);
                  }}
                  key={t}
                >
                  <span className={`day-top`}>
                    {WEEKDAYS[t].slice(0, 3)}
                    {r ? (
                      <Check size={14} />
                    ) : (
                      <span className={`today-mark`} />
                    )}
                  </span>
                  <strong>{addDays(weekStart, t).getDate()}</strong>
                  <span className={`day-name`}>{shortSessionName(e.name)}</span>
                  <span className={`day-type ${e.kind}`}>
                    {sessionKindLabel(e.kind)}
                  </span>
                </button>
              );
            })}
          </div>
  </div>;
  return (
    <Tabs value={tab} onValueChange={setTab} className={`app-shell ${currentSession && tab === `train` ? `is-training` : ``} ${restEndsAt !== null ? `has-rest` : ``}`}>
      <Toaster
        position={`top-center`}
        theme={document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'}
        richColors={false}
        closeButton
        duration={3000}
        offset={{ top: `calc(env(safe-area-inset-top, 0px) + 80px)` }}
        mobileOffset={{ top: `calc(env(safe-area-inset-top, 0px) + 72px)`, left: 16, right: 16 }}
      />
      <AlertDialog
        open={deleteCandidate !== null}
        onOpenChange={(e) => {
          !e && !mutatingRecordId && setDeleteCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Delete this workout?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate?.name}
              {deleteCandidate ? ` · ${formatDate(deleteCandidate.date)}` : ``}
              {`. This removes it from your history and progress. You can restore it from Recently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={mutatingRecordId !== null}
            >{`Keep workout`}</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutatingRecordId !== null}
              onClick={(e) => {
                e.preventDefault();
                deleteCandidate &&
                  changeSessionStatus(deleteCandidate.id, `deleted`);
              }}
            >
              {mutatingRecordId ? `Deleting…` : `Delete workout`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        <BottomNavigation onSelect={(next) => { if (next === `more`) setMoreView(`menu`); if (next === `progress`) setProgressView(`overview`); }} items={[
          { value: `today`, label: `Today`, icon: <House /> },
          { value: `train`, label: `Train`, icon: <Dumbbell /> },
          { value: `progress`, label: `Progress`, icon: <ChartColumn /> },
          { value: `more`, label: `You`, icon: <UserRound /> },
        ]} />
      <main className={`workspace workspace--${tab === 'more' ? moreView : tab} ${tab === 'train' && currentSession ? 'workspace--training' : ''}`}>
        <PageHeader title={tab === `today` ? `Today` : tab === `train` ? `Train` : tab === `progress` ? progressView === 'history' ? 'History' : progressView === 'strength' ? 'Strength' : progressView === 'week' ? 'Your week' : progressView === 'details' ? 'Performance' : 'Progress' : moreView === `nutrition` ? `Nutrition` : moreView === `plan` ? `Training plan` : moreView === `routine` ? `Routine` : moreView === `workouts` ? `My workouts` : `You`}
          action={tab === `train` && !currentSession ? <button type="button" className="icon-button" aria-label="Weekly plan" onClick={openPlan}><ListChecks size={21} /></button> : undefined}
          back={tab === `more` && moreView !== `menu` ? <button className="text-button" onClick={() => setMoreView(`menu`)}><ArrowLeft size={17} />You</button> : tab === `progress` && progressView !== `overview` ? <button className="text-button" onClick={() => { setProgressView(`overview`); setPerformanceAction(undefined); }}><ArrowLeft size={17} />Progress</button> : undefined}
          subtitle={tab === `today` ? new Date(`${today}T12:00:00`).toLocaleDateString(`en-GB`, { weekday: `long`, day: `numeric`, month: `long` }) : undefined} />
        {(saving || profileSaving) && <span className="sr-only" role="status">Saving…</span>}
        {loadError && !(tab === `more` && moreView === `nutrition`) && (
          <div className={`error-banner`} role={`alert`}>
            <p>{loadError}</p>
            <div>
              <button
                className={`btn btn-small`}
                onClick={() =>
                  loaded ? void flushPendingWrites() : void loadWorkouts()
                }
              >{`Retry`}</button>
            </div>
          </div>
        )}
        <TabsContent value="today">
          <TodayView date={today} plan={todayContext.plan} session={activeSession?.date === today ? activeSession : undefined} otherSession={activeSession?.date !== today ? activeSession : undefined} completed={todayCompletedSession} now={now}
            activities={activityRecords} nutrition={reportNutrition} volleyballSchedule={volleyballSchedule}
            sessions={sessions} weeklyPlan={currentWeekPlan} performance={performance.data} bodyWeight={profile.bodyWeight} today={today}
            blockComplete={masterBlockComplete} programLabel={todayMasterWeek ? `Week ${todayMasterWeek} · ${getMasterProgramPhase(todayMasterWeek)}` : masterBlockComplete ? 'Block complete' : undefined} scheduledEvents={masterScheduledEvents(profile.masterProgram, today)}
            onProgress={() => { setProgressView('overview'); setTab('progress'); }}
            disabled={!loaded || saving || profileSaving || !!loadError} onPreview={() => openPreview(todayContext)} onStart={() => startWorkout(todayContext)} onTrain={() => { setEditingHistoryId(null); if (!activeSession) selectTrainingDate(today); setTab(`train`); }} onBrowseTrain={() => setTab(`train`)}
            onViewLog={setSelectedHistory} onNutrition={() => setTab(`nutrition`)} onPlan={() => masterBlockComplete ? openProgramConfiguration() : openPlan()}
            onActivity={() => setTodayActivitiesOpen(true)} />
        </TabsContent>
        <TabsContent value={`train`}>
          {!currentSession && weekSelector}
          <div className={`workout-grid`}>
            <section className={`workout-main`}>
              {!currentSession && scheduledPlan[selectedDay].extraSession && (
                <div
                  className={`session-choice`}
                  role={`group`}
                  aria-label={`Tuesday session`}
                >
                  <button
                    className={extraSessionVisible ? `` : `chosen`}
                    aria-pressed={!extraSessionVisible}
                    onClick={() => setExtraSessionVisible(!1)}
                  >{`Volleyball · ${volleyballSchedule.startTime}`}</button>
                  <button
                    className={extraSessionVisible ? `chosen` : ``}
                    aria-pressed={extraSessionVisible}
                    onClick={() => setExtraSessionVisible(!0)}
                  >{profile.masterProgram ? `Technique · ${scheduledPlan[selectedDay].extraSession.durationRange ?? '8–15 min'}` : `Jump primer · 16:15`}</button>
                </div>
              )}

              <section className={`session-card native-session ${currentSession ? 'session-card--active' : ''} ${editingHistoryId ? 'native-session--editing' : ''}`}>
                <div className="native-session-overview"><p className="session-tag">{editingHistoryId ? 'Editing saved workout' : activeSession ? 'Session in progress' : `${WEEKDAYS[selectedDay]} · ${formatDate(selectedDate, true)}`}</p><h2>{currentSession ? currentSession.goal ? getSessionPurpose(currentSession).title : shortSessionName(currentSession.name) : getSessionPurpose(selectedPlan, selectedDay).title}</h2>{!currentSession && <p className="session-purpose-line">{getSessionPurpose(selectedPlan, selectedDay).subtitle}</p>}<p className="native-session-prescription">{currentSession ? currentSession.kind === `sport` ? `On court · reflect after training` : currentSession.kind === `recovery` && !totalSets ? `${cooldownItems.filter(step => step.done).length} / ${cooldownItems.length} movements complete` : `${doneSets} / ${totalSets} sets complete` : selectedPlan.kind === `recovery` ? `${selectedPlan.durationRange ?? `${selectedPlan.minutes} min`} · mobility & stretching` : selectedPlan.kind === `sport` ? /match/i.test(selectedPlan.name) ? `Match · ${selectedPlan.startTime ?? "time not set"} · record actual duration` : `${selectedPlan.minutes} min · on court` : `${selectedWorkingExercises.length} exercises · ${totalSets} sets · ${selectedPlan.durationRange ?? `${selectedPlan.minutes} min`}`}</p></div>
                <div className="native-session-actionbar">{activeSession && <span className="session-clock"><Clock3 size={14} />{formatElapsedTime(sessionDuration(activeSession, now))}</span>}
                  {editingHistoryId ? (
                    <button
                      className={`btn lime`}
                      onClick={() => setEditingHistoryId(null)}
                    >
                      <Check size={18} />
                      {` Done editing`}
                    </button>
                  ) : activeSession ? (
                    <div className={`session-actions`}>
                      <button
                        className={`btn btn-outline-light icon-only`}
                        aria-label={
                          activeSession.runningSince === null
                            ? `Resume workout`
                            : `Pause workout`
                        }
                        onClick={toggleWorkoutTimer}
                      >
                        {activeSession.runningSince === null ? (
                          <Play size={18} />
                        ) : (
                          <Pause size={18} />
                        )}
                      </button>
                      <button
                        className={`btn secondary`}
                        aria-label="Finish workout"
                        onClick={() => {
                          setFinishMinutes(
                            String(
                              Math.max(
                                1,
                                Math.round(
                                  sessionDuration(activeSession) / 6e3,
                                ) / 10,
                              ),
                            ),
                          );
                          setWatchCalories(
                            activeSession.watchCalories === null
                              ? ``
                              : String(activeSession.watchCalories),
                          );
                          setFinishOpen(!0);
                        }}
                      >
                        <Check size={18} />
                        {` Finish`}
                      </button>
                    </div>
                  ) : (
                    <div className="train-plan-actions">
                    <button type="button" className="btn train-plan-preview" disabled={!loaded || !!loadError} onClick={() => openPreview()}>View workout</button>
                    <button
                      className={`btn lime`}
                      disabled={
                        !loaded ||
                        saving ||
                        !!loadError ||
                        (selectedWorkingExercises.length === 0 && selectedPlan.kind !== `recovery`)
                      }
                      onClick={() => startWorkout()}
                    >
                      <Play size={18} />
                      {` Start `}
                      {selectedPlan.kind === `recovery`
                        ? `recovery`
                        : `workout`}
                    </button>
                    </div>
                  )}
                </div>
                {editingHistoryId ? (
                  <p className={`editing-save-note`}>{`Changes save automatically. Extra activities below are logged for ${formatDate(workoutDate)}, ${workoutDate.slice(0, 4)}.`}</p>
                ) : currentSession ? (
                  totalSets > 0 && <Progress
                    className={`workout-progress`}
                    value={totalSets ? (doneSets / totalSets) * 100 : 0}
                    aria-label={`Completed sets`}
                  />
                ) : (
                  <details className="session-note"><summary>Session focus</summary><p>{getSessionPurpose(selectedPlan, selectedDay).focus}</p><p>Intensity · {getSessionPurpose(selectedPlan, selectedDay).intensity}</p><p>{getSessionPurpose(selectedPlan, selectedDay).fatigue}</p><p>{selectedPlan.note}</p></details>
                )}
              </section>
              {!currentSession && masterWeek && <>
                <div className="master-day-note"><p><strong>{`Week ${masterWeek} · ${getMasterProgramPhase(masterWeek)}`}</strong><span>{selectedMasterMatch ? 'Sunday match week' : 'No Sunday match'}</span></p>{dayEvents.map(event => <p key={event.name}><strong>{event.name}</strong><span>{event.detail}</span></p>)}</div>
                {(selectedPlan.kind === 'strength' || isMasterReadinessRequired(profile.masterProgram, selectedDate, selectedPlan)) && <MasterProgramReadiness settings={profile.masterProgram} date={selectedDate} disabled={profileSaving || !loaded} onSave={saveMasterProgram} />}
              </>}
              {dayCompletedSession && !currentSession && (
                <div className={`completed-banner`}>
                  <CheckCheck size={18} />
                  <span>
                    {`You’ve recorded `}
                    {dayCompletedSession.name}
                    {` on this day.`}
                  </span>
                  <button
                    className={`text-button`}
                    onClick={() => setSelectedHistory(dayCompletedSession)}
                  >{`View log`}</button>
                </div>
              )}
              {!currentSession && <details className="workout-template-actions"><summary>Workout options</summary><div className="workout-template-options"><button type="button" className="text-button" disabled={!loaded} onClick={() => setWorkoutChooserOpen(true)}>Choose workout</button><button type="button" className="text-button" disabled={!loaded} onClick={() => openCustomWorkout()}>Create workout</button></div></details>}
              {loggedJumpContacts && loggedJumpContacts.planned > 0 && <p className="master-contact-status" role="status" aria-label="Main jump contacts">{loggedJumpContacts.completed} / {loggedJumpContacts.planned} main contacts{loggedJumpContacts.completed >= loggedJumpContacts.planned ? ' · Ceiling reached; stop the jump block.' : ' · Ceiling, not a target to force.'}</p>}
              {currentSession ? (
                <React.Fragment>
                  {currentSession.kind === 'recovery' && !currentSession.exercises.length ? <section className="recovery-session" aria-label="Recovery session"><PreparationChecklist items={cooldownItems} phase="cooldown" kind="recovery" defaultOpen onToggle={(key, done) => togglePreparation('cooldown', key, done)} /><WorkoutCustomizer session={currentSession} selectedKey={exerciseActionKey} onSelectedKeyChange={setExerciseActionKey}
                    onChange={customizeSession} onSaveAs={saveCurrentAsWorkout}
                    readiness={performance.data?.readiness.find(row => row.date === currentSession.date)} onReadiness={performance.saveReadiness}
                    disabled={saving || !!loadError} /></section> : <>
                  {currentSession.kind === 'sport' && <section className="sport-reflection" aria-label="Volleyball reflection"><h3>How did training feel?</h3><p>What went well? One thing to work on next time.</p><label className="sr-only" htmlFor="volleyball-reflection">Volleyball reflection</label><textarea id="volleyball-reflection" maxLength={2000} placeholder="Energy, jumps, hitting, or one small win…" value={currentSession.notes} onChange={event => updateSession(session => ({ ...session, notes: event.target.value }))} /></section>}
                  <SessionExerciseArea sport={currentSession.kind === 'sport'} editing={!!editingHistoryId}>
                  <FocusedWorkout sessionId={currentSession.id} exercises={currentSession.exercises} now={now} editing={!!editingHistoryId}
                  sessions={completedSessions} date={currentSession.date}
                  context={{ readiness: performance.data?.readiness.find(row => row.date === currentSession.date),
                    lowFatigueSession: /primer/i.test(currentSession.name) || ['yellow', 'red'].includes(profile.masterProgram?.readiness?.find(row => row.date === currentSession.date)?.status) || (currentSession.programRevision === '8.1' && profile.masterProgram && [4, 8].includes(getMasterProgramWeek(profile.masterProgram.startDate, currentSession.date))),
                    volleyballWithin24Hours: currentSession.date === today && volleyballIsSoon() }}
                  onExerciseAction={setExerciseActionKey}
                  previous={(exercise) => comparablePrevious(exercise, currentSession.date, currentSession.id)}
                  onSet={updateSet} onDone={markSetDone} onTimer={toggleMovementTimer}
                  renderAllSets={(e, t) => (
                    <ExerciseTracker
                      defaultExpanded
                      exercise={e}
                      index={t}
                      now={now}
                      last={comparablePrevious(
                        e,
                        currentSession.date,
                        currentSession.id,
                      )}
                      editing={!!editingHistoryId}
                      onSet={(t, n) => updateSet(e.key, t, n, !0)}
                      onDone={(t, n) => markSetDone(e.key, t, n)}
                      onTimer={() => toggleSetStopwatch(e.key)}
                      onAdd={() =>
                        updateExercise(e.key, (e) => ({
                          ...e,
                          logs: [
                            ...e.logs,
                            {
                              id: crypto.randomUUID(),
                              kg: e.logs.at(-1)?.kg ?? null,
                              reps: null,
                              seconds: null,
                              rir: null,
                              done: !1,
                            },
                          ],
                        }))
                      }
                      onRemove={() =>
                        updateExercise(e.key, (e) => ({
                          ...e,
                          logs: e.logs.slice(0, -1),
                          ...(e.timerSetId === e.logs.at(-1)?.id
                            ? { timerSetId: null, elapsedMs: 0, runningSince: null } : {}),
                        }))
                      }
                      key={`${currentSession.id}-${e.key}`}
                    />
                  )} />
                  <WorkoutCustomizer session={currentSession} selectedKey={exerciseActionKey} onSelectedKeyChange={setExerciseActionKey}
                    onChange={customizeSession} onSaveAs={saveCurrentAsWorkout}
                    readiness={performance.data?.readiness.find(row => row.date === currentSession.date)} onReadiness={performance.saveReadiness}
                    disabled={saving || !!loadError} />
                  </SessionExerciseArea></>}
                </React.Fragment>
              ) : (
                <div className="planned-section">
                <details className="planned-preview"><summary>Exercises <span>{selectedWorkingExercises.length}</span></summary>
                <WorkoutPreview exercises={selectedPlan.exercises} previous={exercise => {
                  const previous = comparablePrevious(exercise, selectedDate);
                  const best = topSet(previous?.exercise);
                  return best ? `${formatNumber(best.kg)} kg × ${best.reps}` : previous
                    ? `${previous.exercise.logs.filter(log => log.done).length} sets last time` : undefined;
                }} /></details>
                </div>
              )}
              {!(currentSession?.kind === 'recovery' && !currentSession.exercises.length) && <button type="button" className="stretch-shortcut" onClick={() => openStretches()}><span><strong>Cool-down & stretching</strong><small>Matched to this session</small></span><ChevronRight size={18} /></button>}
            </section>
            <details className="train-utilities"><summary>Session tools</summary><div className="train-utilities-content"><section className="workout-preparation">
              <details className="train-activities"><summary>Activities</summary>
              <ExtraActivities
                date={workoutDate}
                bodyWeight={profile.bodyWeight}
                records={activityRecords}
                onSave={saveExtraActivity}
                disabled={!loaded}
              />
              <ActivityImport bodyWeight={profile.bodyWeight} records={activityRecords} onImport={importExtraActivities} disabled={!loaded} />
              </details>
              {currentSession?.warmupStatus && <p className="preparation-record" aria-label="Recorded warm-up">{{ prepared: 'Quick warm-up complete', elsewhere: 'Warmed up elsewhere', 'not-recorded': 'Warm-up not marked complete' }[currentSession.warmupStatus]}</p>}
              <PreparationChecklist
                items={warmupItems}
                compact
                phase={`warmup`}
                kind={currentSession?.kind ?? selectedPlan.kind}
                onToggle={
                  currentSession
                    ? (e, t) => togglePreparation(`warmup`, e, t)
                    : void 0
                }
                key={`${currentSession?.id ?? selectedDate}-${selectedPlan.name}-warmup`}
              />
              <PreparationChecklist
                items={cooldownItems}
                compact
                phase={`cooldown`}
                kind={currentSession?.kind ?? selectedPlan.kind}
                onToggle={
                  currentSession
                    ? (e, t) => togglePreparation(`cooldown`, e, t)
                    : void 0
                }
                key={`${currentSession?.id ?? selectedDate}-${selectedPlan.name}-cooldown`}
              />
              {currentSession && (
                <div className={`workout-notes`}>
                  {currentSession.kind !== 'sport' && <details><summary>Workout notes</summary>
                  <label htmlFor={`workout-notes`}>{`Workout notes`}</label>
                  <textarea
                    id={`workout-notes`}
                    placeholder={`How did it feel? Any adjustments for next time?`}
                    value={currentSession.notes}
                    maxLength={2e3}
                    onChange={(e) =>
                      updateSession((t) => ({
                        ...t,
                        notes: e.target.value,
                      }))
                    }
                  />
                  </details>}
                  {activeSession && (
                    <button
                      className={`text-button danger`}
                      onClick={() => setDiscardOpen(!0)}
                    >{`Discard this workout`}</button>
                  )}
                </div>
              )}
            </section>
            <aside className="workout-side">
              <details className="train-secondary"><summary>Session details</summary>
              <section className={`panel session-stats`}>
                <div className={`panel-heading`}>
                  <h3>{currentSession ? `This session` : `This week`}</h3>
                  <span className={`small-label`}>
                    {currentSession
                      ? sessionKindLabel(currentSession.kind)
                      : `RECORDED`}
                  </span>
                </div>
                <div className={`stats-grid`}>
                  <MetricCard
                    icon={<Clock3 />}
                    label={`Minutes`}
                    value={formatNumber(
                      currentSession
                        ? sessionDuration(currentSession, now) / 6e4
                        : weekCompletedSessions.reduce(
                            (e, t) => e + sessionDuration(t) / 6e4,
                            0,
                          ) + extraWeekMinutes,
                    )}
                    loaded={loaded}
                  />
                  <MetricCard
                    icon={<Dumbbell />}
                    label={`Sets done`}
                    value={String(
                      currentSession
                        ? completedSets(currentSession)
                        : weekCompletedSessions.reduce(
                            (e, t) => e + completedSets(t),
                            0,
                          ),
                    )}
                    loaded={loaded}
                  />
                  <MetricCard
                    icon={<Zap />}
                    label={`Volume · kg`}
                    value={formatNumber(
                      currentSession
                        ? estimatedCalories(currentSession.exercises)
                        : weekCompletedSessions.reduce(
                            (e, t) => e + estimatedCalories(t.exercises),
                            0,
                          ),
                    )}
                    loaded={loaded}
                  />
                  <MetricCard
                    icon={<Flame />}
                    label={
                      currentSession?.watchCalories !== null &&
                      currentSession?.watchCalories !== void 0
                        ? `Active kcal · entered`
                        : `Active kcal · est.`
                    }
                    value={formatNumber(
                      currentSession
                        ? getCalories(currentSession, now)
                        : weekCompletedSessions.reduce(
                            (e, t) => e + getCalories(t),
                            0,
                          ) + extraWeekCalories,
                    )}
                    loaded={loaded}
                  />
                </div>
                <button
                  className={`text-button calorie-info`}
                  onClick={() => {
                    setSettingsDraft({
                      bodyWeight: profile.bodyWeight,
                      restSeconds: profile.restSeconds,
                    });
                    setSettingsOpen(!0);
                  }}
                >{`How calories are estimated`}</button>
              </section>
              </details>
              <details className="train-secondary"><summary>Rest timer</summary>
              <section className={`panel rest-panel`}>
                <div className={`panel-heading`}>
                  <h3>{`Rest timer`}</h3>
                  <Timer size={18} />
                </div>
                <div
                  className={`rest-clock ${restRemaining > 0 ? `counting` : ``}`}
                  role={`timer`}
                  aria-label={`Rest time remaining`}
                >
                  {formatElapsedTime(
                    restRemaining > 0 ? restRemaining : restSeconds * 1e3,
                  )}
                </div>
                <div className={`rest-presets`}>
                  {[60, 90, 120, 180].map((e) => (
                    <button
                      className={restSeconds === e ? `chosen` : ``}
                      onClick={() => {
                        setRestSeconds(e);
                        restEndsAt !== null &&
                          (void restAudio.unlock(), setRestEndsAt(Date.now() + e * 1e3));
                      }}
                      key={e}
                    >
                      {e}
                      {`s`}
                    </button>
                  ))}
                </div>
                <div className={`rest-actions`}>
                  {restEndsAt === null ? (
                    <button
                      className={`btn full`}
                      onClick={() =>
                        (void restAudio.unlock(), setRestEndsAt(Date.now() + restSeconds * 1e3))
                      }
                    >
                      <Play size={16} />
                      {` Start rest`}
                    </button>
                  ) : (
                    <ReactJSX.Fragment>
                      <button
                        className={`btn secondary`}
                        onClick={() => setRestEndsAt(restEndsAt + 15e3)}
                      >{`+15 sec`}</button>
                      <button
                        className={`btn`}
                        onClick={() => setRestEndsAt(null)}
                      >{`Skip rest`}</button>
                    </ReactJSX.Fragment>
                  )}
                </div>
                <p
                  className={`small-note`}
                >{`Starts after each completed gym set. Keep the app open for the rest alert.`}</p>
                <button type="button" className="text-button" onClick={() => { openSettings(); setTimeout(() => document.querySelector('.timer-sound-settings')?.scrollIntoView({ block: 'start' }), 0); }}>Timer sound</button>
              </section>
              </details>
              <details className="train-secondary"><summary>Fuel &amp; recovery</summary>
                <ShortRoutine input={dailyContext(workoutDate).input} />
                {guidanceForDate(workoutDate, false)}
              </details>
            </aside></div></details>
          </div>
        </TabsContent>
        <TabsContent value="progress">
          {performance.error && <div className="error-state" role="alert"><p>{performance.error}</p><button className="text-button" onClick={performance.reload}>Reload performance</button></div>}
          {progressView === 'details' && <>
            <PerformanceDetails sessions={sessions} activities={activityRecords} plan={currentWeekPlan} nutritionRecords={reportNutrition}
              performance={performance.data} bodyWeight={profile.bodyWeight} today={today} initialAction={performanceAction}
              onSaveJump={performance.saveJump} onSaveJumps={performance.saveJumps} onDeleteJump={performance.deleteJump}
              onLogWeight={() => { setNutritionAction('weight'); setTab('nutrition'); }} /></>}
          {progressView === `overview` && <ProgressOverview sessions={sessions} activities={activityRecords} plan={currentWeekPlan} bodyWeight={profile.bodyWeight} nutritionRecords={reportNutrition} performance={performance.data} today={today}
            onViewPerformance={() => { setPerformanceAction(undefined); setProgressView('details'); }}
            onLogJump={() => { setPerformanceAction('log-jump'); setProgressView('details'); }}
            onViewStrength={() => setProgressView(`strength`)} onViewHistory={() => setProgressView(`history`)} onViewWeek={() => setProgressView(`week`)} onLogWeight={() => { setNutritionAction(`weight`); setTab(`nutrition`); }} />}
          {progressView === `strength` && <>          <div className={`progress-picker`}>
            <label htmlFor={`progress-exercise`}>{`Movement`}</label>
            <Select
              value={progressExercise ? exercisePerformanceIdentity(progressExercise) : undefined}
              onValueChange={setProgressExerciseKey}
            >
              <SelectTrigger id={`progress-exercise`} className={`wide-select`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allExercises.map((e) => (
                  <SelectItem value={exercisePerformanceIdentity(e)} key={exercisePerformanceIdentity(e)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <section className={`panel progress-panel`}>
            <div className={`panel-heading`}>
              <h2>{progressExercise?.name ?? `Exercise progress`}</h2>
              <span className={`muted`}>{chartMetricLabel}</span>
            </div>
            {chartData.length < 2 ? (
              <div className={`empty-state`}>
                <ChartColumn size={32} />
                <h3>
                  {chartData.length
                    ? `One workout recorded. Keep going.`
                    : `Your progress will show here.`}
                </h3>
                <p>{`Log this movement in two workouts to see the comparison.`}</p>
              </div>
            ) : (
              <div className={`chart-wrap`}>
                <ResponsiveContainer width={`100%`} height={280}>
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 20,
                      right: 16,
                      left: 0,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid stroke={`var(--line)`} vertical={!1} />
                    <XAxis
                      dataKey={`date`}
                      tick={{
                        fill: `#627069`,
                        fontSize: 12,
                      }}
                      axisLine={!1}
                      tickLine={!1}
                    />
                    <YAxis
                      tick={{
                        fill: `#627069`,
                        fontSize: 12,
                      }}
                      axisLine={!1}
                      tickLine={!1}
                      width={44}
                    />
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: `#e2e8e3`,
                      }}
                      formatter={(e) => [e, chartMetricLabel]}
                    />
                    <Line
                      type={`linear`}
                      dataKey={`value`}
                      stroke={`var(--accent)`}
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: `var(--accent)`,
                        stroke: `var(--canvas)`,
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div
              className={`progress-caption`}
            >{`Only completed sets count. Jump charts use your best recorded measurement per session. Weight comparisons are most useful with the same machine, setup, and rep range.`}</div>
          </section>
          {exerciseSessions.length > 0 && (
            <section className={`panel movement-history`}>
              <h3>{`Session by session`}</h3>
              {exerciseSessions
                .slice()
                .reverse()
                .map((e) => {
                  let t = e.exercises.find(
                    (e) => areComparableExercises(e, progressExercise),
                  );
                  let n = topSet(t);
                  return (
                    <button onClick={() => setSelectedHistory(e)} key={e.id}>
                      <span>
                        <strong>{formatDate(e.date, !0)}</strong>
                        <small>{e.name}</small>
                      </span>
                      <span>
                        {progressExercise.measurement
                          ? bestMeasurement(t) === null
                            ? `No measurement`
                            : `${formatNumber(bestMeasurement(t))} cm`
                          : n
                            ? `${formatNumber(n.kg)} kg × ${n.reps}`
                            : t.mode === `timed`
                              ? `${formatNumber(t.logs.filter((e) => e.done).reduce((e, t) => e + (t.seconds ?? 0), 0))} sec`
                              : `${t.logs.filter((e) => e.done).reduce((e, t) => e + (t.reps ?? 0), 0)} reps`}
                      </span>
                      <span>
                        {t.logs.filter((e) => e.done).length}
                        {` sets`}
                      </span>
                      <span>{formatElapsedTime(formatDuration(t))}</span>
                    </button>
                  );
                })}
            </section>
          )}
</>}
          {progressView === `history` && <>
          <div
            className={`history-views`}
            role={`group`}
            aria-label={`Workout records`}
          >
            <button
              className={recentlyDeletedOpen ? `` : `chosen`}
              aria-pressed={!recentlyDeletedOpen}
              onClick={() => setRecentlyDeletedOpen(!1)}
            >{`All workouts`}</button>
            <button
              className={recentlyDeletedOpen ? `chosen` : ``}
              aria-pressed={recentlyDeletedOpen}
              onClick={() => setRecentlyDeletedOpen(!0)}
            >
              {`Recently deleted`}
              {deletedSessions.length ? ` (${deletedSessions.length})` : ``}
            </button>
          </div>
          {recentlyDeletedOpen ? (
            <section className={`panel deleted-records`}>
              <h2>{`Recently deleted`}</h2>
              <p
                className={`small-note`}
              >{`Deleted workouts are excluded from history and progress. Restore a record to bring it back.`}</p>
              {deletedSessions.length ? (
                deletedSessions.map((e) => (
                  <div className={`deleted-record`} key={e.id}>
                    <div>
                      <h3>{e.name}</h3>
                      <p>
                        {formatDate(e.date)}
                        {` `}
                        {e.date.slice(0, 4)}
                        {` · `}
                        {formatNumber(sessionDuration(e) / 6e4)}
                        {` min · `}
                        {completedSets(e)}
                        {` sets`}
                      </p>
                    </div>
                    <button
                      className={`btn secondary`}
                      disabled={mutatingRecordId !== null}
                      onClick={() =>
                        void changeSessionStatus(e.id, `completed`)
                      }
                    >
                      {mutatingRecordId === e.id ? `Restoring…` : `Restore`}
                    </button>
                  </div>
                ))
              ) : (
                <p className={`empty-trash`}>{`No deleted workouts.`}</p>
              )}
            </section>
          ) : (
            <ReactJSX.Fragment>
              <div className={`history-top`}>
                <span className={`muted`}>
                  {completedSessions.length}
                  {` completed workouts`}
                </span>
                <span
                  className={`muted`}
                >{`Your saved sets, weights, and times`}</span>
              </div>
              {completedSessions.length ? (
                <div className={`history-grid`}>
                  {completedSessions.map((e) => (
                    <button
                      className={`history-card`}
                      onClick={() => setSelectedHistory(e)}
                      key={e.id}
                    >
                      <div className={`history-card-top`}>
                        <span className={`kind-badge ${e.kind}`}>
                          <SessionKindIcon kind={e.kind} size={16} />
                          {sessionKindLabel(e.kind)}
                        </span>
                        <span>
                          {formatDate(e.date, !0)}
                          {` `}
                          {e.date.slice(0, 4)}
                        </span>
                      </div>
                      <h2>{e.name}</h2>
                      <p>{WEEKDAYS[e.day]}</p>
                      <div className={`history-metrics`}>
                        <span>
                          <Clock3 size={15} />
                          {formatNumber(sessionDuration(e) / 6e4)}
                          {` min`}
                        </span>
                        <span>
                          <Dumbbell size={15} />
                          {completedSets(e)}
                          {` sets`}
                        </span>
                        <span>
                          <Flame size={15} />
                          {getCalories(e)}
                          {` kcal`}
                          {e.watchCalories === null ? ` est.` : ``}
                        </span>
                      </div>
                      <div className={`history-volume`}>
                        {formatNumber(estimatedCalories(e.exercises))}
                        {` `}
                        <span>{`kg total volume`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`empty-state large`}>
                  <RotateCcwClock size={34} />
                  <h2>{`Your first workout starts the story.`}</h2>
                  <p>{`Finish a session to see every set and your workout summary here.`}</p>
                  <button
                    className={`btn`}
                    onClick={() => setTab(`train`)}
                  >{`Open workout`}</button>
                </div>
              )}
            </ReactJSX.Fragment>
          )}
          {!recentlyDeletedOpen && <ActivityHistory records={activityRecords} bodyWeight={profile.bodyWeight} onSave={saveExtraActivity} disabled={!loaded} />}
</>}
          {progressView === `week` && <>
          <WeeklyPerformance sessions={sessions} activities={activityRecords} plan={planForDate(progressReportWeek)} weekStart={progressReportWeek} volleyballSchedule={volleyballSchedule} />
          <WeeklyReport sessions={sessions} activities={activityRecords} plan={planForDate(progressReportWeek)} bodyWeight={profile.bodyWeight} initialWeek={dateKey(weekStart)} nutritionRecords={reportNutrition} onWeekChange={setProgressReportWeek} />
          {reportNutritionError && <p className={`nutrition-error`} role={`alert`}>{reportNutritionError} <button className={`text-button`} onClick={() => void loadReportNutrition()}>{`Retry nutrition logs`}</button></p>}
<details className="report-activity-details"><summary>Activity totals</summary>          <section className={`panel extra-progress`} aria-label={`Extra activity progress`}>
            <h3>{`Extra activity progress`}</h3>
            <p className={`small-note`}>{`${formatDate(progressReportWeek, !0)} – ${formatDate(dateKey(addDays(new Date(`${progressReportWeek}T12:00:00`), 6)), !0)} · Recorded outside your workout sessions`}</p>
            <div className={`daily-training-total`}>
              <span><strong>{reportWeekActivities.length}</strong>{` extra activities`}</span>
              <span><strong>{formatNumber(reportExtraMinutes)}</strong>{` minutes`}</span>
              <span><strong>{formatNumber(reportExtraCalories)}</strong>{` active kcal`}</span>
            </div>
          </section>
</details></>}
        </TabsContent>
        <TabsContent value="more">
          {moreView === `nutrition` && <NutritionView bodyWeight={profile.bodyWeight} dailyGuidance={guidanceForDate}
            nutritionProfile={profile.nutrition}
            onNutritionProfileChange={saveNutritionProfile} volleyballSchedule={volleyballSchedule} initialAction={nutritionAction} onActionHandled={() => setNutritionAction(null)} onOpenRoutine={(date) => { setRoutineDate(date); setMoreView(`routine`); }} />}
          {moreView === `plan` && <>

          <section className="native-week" aria-label="Weekly training schedule"><p className="eyebrow">This week</p><div className="plan-timeline">{(profile.masterProgram && !masterWeek ? editableWeekPlan : scheduledPlan).map((e, t) => {
            const date = dateKey(addDays(weekStart, t)); const recorded = completedSessions.some(session => session.date === date);
            return <article className={`plan-day${date === today ? ' is-today' : ''}`} key={t}><div className="plan-day__date"><span>{WEEKDAYS[t].slice(0, 3)}</span><strong>{addDays(weekStart, t).getDate()}</strong></div><details className="plan-day-details"><summary><strong>{getSessionPurpose(e, t).title}</strong><span>{e.kind === 'sport' && e.name === 'Volleyball' ? `${volleyballSchedule.startTime}–${volleyballSchedule.endTime}` : /match/i.test(e.name) ? `Match · ${e.startTime ?? 'time not set'}` : `${e.durationRange ?? `${e.minutes} min`} · ${getSessionPurpose(e, t).subtitle}`}{recorded ? ' · Recorded' : date === today ? ' · Today' : ''}</span><ChevronRight size={16} /></summary><PlanDayDetails plan={e} /></details><button type="button" className="icon-button" aria-label={`Edit ${WEEKDAYS[t]}`} disabled={!loaded} onClick={() => editPlanDay(t)}>{recorded ? <Check size={17} /> : <Ellipsis size={20} />}</button>{e.extraSession && <div className="plan-day__extra"><details className="plan-day-details"><summary><strong>{shortSessionName(e.extraSession.name)}</strong><span>{e.extraSession.minutes} min</span><ChevronRight size={15} /></summary><PlanDayDetails plan={e.extraSession} /></details><button className="text-button" disabled={!loaded} onClick={() => editPlanDay(t, true)}><Pencil size={14} />Edit primer</button></div>}</article>;
          })}</div></section>
          <details className="plan-schedule"><summary>Volleyball schedule <span>{volleyballSchedule.startTime}–{volleyballSchedule.endTime}</span></summary><TrainingSchedule schedule={volleyballSchedule} onSave={saveVolleyballSchedule} /></details>
          <details className="native-program-options"><summary>Programme & customization</summary>          <VolleyballMasterProgram settings={profile.masterProgram} defaultStartDate={dateKey(addDays(new Date(`${masterWeekStart(today)}T12:00:00`), 7))} selectedDate={selectedDate} today={today} basePlan={profile.plan} matchWeekend={profile.masterMatchWeekend} onSave={saveMasterProgram} onUpgrade={upgradeProgram} onRestorePrevious={restorePreviousProgram} hasPreviousPlan={!!profile.masterProgramBackup} disabled={profileSaving || !loaded} />
          {!profile.masterProgram && <details className="plan-program"><summary>Jump training block</summary>
          <section className={`panel program-overview`}>
            <div className={`panel-heading`}>
              <h2>{`Your 8-week jump block`}</h2>
              <span className={`small-label`}>{`QUALITY FIRST`}</span>
            </div>
            <div className={`program-phases`}>
              {EXERCISE_LIBRARY.map((e) => (
                <div key={e.weeks}>
                  <span>{e.weeks}</span>
                  <h3>{e.title}</h3>
                  <p>{e.note}</p>
                </div>
              ))}
            </div>
            <p
              className={`small-note`}
            >{`Use these phases to adjust your sessions; set counts stay editable. Every two weeks, record body weight in Nutrition, CMJ height and your highest approach-jump touch. Test in the same place, shoes, warm-up and approach distance. Aim for gradual muscle gain while staying fast and springy.`}</p>
          </section>
          </details>}
          <WeeklyPlanTools plan={editableWeekPlan} templates={profile.customWorkouts ?? []} disabled={profileSaving || !loaded}
            onChange={saveBaseWeek} onCreateWorkout={day => openCustomWorkout(null, day)}
            onEditTemplate={template => openCustomWorkout(template)} onReset={() => setResetPlanOpen(true)} />
</details>
</>}
          {moreView === 'workouts' && <section className="custom-workouts-page">
            <div className="section-line"><h2>Saved sessions</h2><button type="button" className="text-button" onClick={() => openCustomWorkout()}><Plus size={18} /> Create workout</button></div>
            {(profile.customWorkouts ?? []).length === 0 && <div className="empty-state"><Dumbbell /><h3>Your own training</h3><p>Build a session you can use any day.</p></div>}
            <ul className="saved-workouts-list">{(profile.customWorkouts ?? []).map(workout => <li key={workout.id}>
              <button className="saved-workout-row" onClick={() => void startCustomWorkout(workout)} disabled={saving || !loaded} aria-label={`Use custom workout ${workout.name}`} ><span><strong>{workout.name}</strong><span>{workout.exercises.length} exercises · {workout.minutes} min</span></span><ChevronRight size={18} /></button>
              <button className="text-button" aria-label={`Edit custom workout ${workout.name}`} onClick={() => openCustomWorkout(workout)}>Edit</button>
            </li>)}</ul>
          </section>}
          {moreView === `routine` && <RemindersPanel showHeading={false} date={routineDate} onDateChange={setRoutineDate} />}
          {moreView === `menu` && <div className="more-menu">
            <section className="native-menu-section"><h2>Daily</h2><div className="menu-group"><MenuRow title="Nutrition" subtitle="Meals & daily targets" onClick={() => setTab('nutrition')} /><MenuRow title="Routine" subtitle="Supplements & medication" onClick={() => setMoreView('routine')} /></div></section>
            <section className="native-menu-section"><h2>Training</h2><div className="menu-group"><MenuRow title="Training plan" icon={<ListChecks />} onClick={openPlan} /><MenuRow title="My workouts" icon={<Dumbbell />} onClick={() => setMoreView('workouts')} /><MenuRow title="Exercise library" icon={<Search />} onClick={() => setLibraryOpen(true)} /></div></section>
            <section className="native-menu-section"><h2>Your records</h2><div className="menu-group"><MenuRow title="History" icon={<History />} onClick={() => { setProgressView('history'); setTab('progress'); }} /><MenuRow title="Body weight" icon={<Activity />} onClick={() => { setNutritionAction('weight'); setTab('nutrition'); }} /><MenuRow title="Jump tests" icon={<ChartColumn />} onClick={() => { setPerformanceAction('log-jump'); setProgressView('details'); setTab('progress'); }} /></div></section>
            <section className="native-menu-section"><h2>App & data</h2><div className="menu-group"><MenuRow title="Settings" onClick={openSettings} /><MenuRow title="Import activities" subtitle="Strava, Adidas Running & watch exports" icon={<Upload />} onClick={() => setImportOpen(true)} /><MenuRow title="Backup & data" icon={<ShieldCheck />} onClick={openSettings} /><MenuRow title="Install Setline" icon={<House />} onClick={() => setInstallOpen(true)} /></div></section>
            <ActivityImport bodyWeight={profile.bodyWeight} records={activityRecords} onImport={importExtraActivities} disabled={!loaded} open={importOpen} onOpenChange={setImportOpen} hideLauncher />
          </div>}
          <ExerciseLibrarySheet open={libraryOpen} onOpenChange={setLibraryOpen} onSelect={() => {}} browseOnly />
        </TabsContent>
      </main>
      {restEndsAt !== null && (
        <div className={`rest-floating`}>
          <Timer size={18} />
          <span>{`Rest`}</span>
          <strong>{formatElapsedTime(restRemaining)}</strong>
          <button aria-label="Reduce rest by 15 seconds" onClick={() => { setNow(Date.now()); setRestEndsAt(Math.max(Date.now(), restEndsAt - 15000)); }}>−15</button>
          <button aria-label="Add 15 seconds rest" onClick={() => setRestEndsAt(restEndsAt + 15000)}>+15</button>
          <button onClick={() => setRestEndsAt(null)} aria-label="Skip rest">Skip</button>
        </div>
      )}
      {restFinished && <section className="rest-finished" role="status" aria-label="Rest complete">
        <Check size={21} aria-hidden="true" /><div><strong>Rest complete</strong><span>{restFinished.resumed ? 'Finished while you were away.' : restFinished.needsAudioTap ? 'Sound needs a tap.' : 'Ready when you are.'}</span></div>
        {restFinished.needsAudioTap && <button type="button" className="text-button" onClick={() => { openSettings(); setTimeout(() => document.querySelector('.timer-sound-settings')?.scrollIntoView({ block: 'start' }), 0); }}>Check sound</button>}
        <button type="button" className="icon-button" aria-label="Dismiss rest complete" onClick={() => setRestFinished(null)}><X size={18} /></button>
      </section>}
      <WorkoutPlanPreview open={previewContext !== null} onOpenChange={open => { if (!open) setPreviewContext(null); }} plan={previewWorkout.plan}
        dayLabel={formatDate(previewWorkout.date, true)} warmup={getQuickWarmup(previewWorkout.plan, preparationFor(previewWorkout.plan, 'warmup'))}
        disabled={!loaded || profileSaving || !!loadError || !!activeSession}
        onChange={plan => saveDayDraft({ ...plan, warmup: preparationFor({ ...plan, warmup: plan.warmup?.map(step => ({ ...step, done: false })) }, 'warmup') }, { date: previewWorkout.date, slot: previewWorkout.slot, customized: true })}
        onStart={() => startWorkout(previewWorkout)} />
      <Dialog open={todayActivitiesOpen} onOpenChange={setTodayActivitiesOpen}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Today’s activities</DialogTitle><DialogDescription>{formatDate(today)} · recorded outside your workout</DialogDescription></DialogHeader><ExtraActivities date={today} bodyWeight={profile.bodyWeight} records={activityRecords} onSave={saveExtraActivity} disabled={!loaded || !!loadError} /></DialogContent></Dialog>
      <WarmupFlow open={warmupContext !== null} onOpenChange={open => { if (!open) setWarmupContext(null); }}
        plan={warmupPlan} items={gateWarmupItems} override={preparationDraft?.warmupOverride === true}
        disabled={profileSaving || saving || !!loadError}
        onChange={items => saveDayDraft({ ...warmupPlan, warmup: items }, { date: warmupContext.date, slot: warmupContext.slot, override: preparationDraft?.warmupOverride ?? false })}
        onOverride={() => saveDayDraft(warmupPlan, { date: warmupContext.date, slot: warmupContext.slot, override: true })}
        onStart={startMainWorkout} />
      <Dialog open={stretchContext !== null} onOpenChange={open => { if (!open) setStretchContext(null); }}><DialogContent className="app-dialog stretch-sheet"><DialogHeader><DialogTitle>Stretch routine</DialogTitle><DialogDescription>{stretchDescription}</DialogDescription></DialogHeader><PreparationChecklist items={stretchItems} phase="cooldown" kind={stretchSession?.kind ?? 'strength'} defaultOpen onToggle={stretchSession && !loadError ? (key, done) => { const source = sessionsRef.current.find(session => session.id === stretchSession.id); if (source) queueSession({ ...source, cooldown: preparationFor(source, 'cooldown').map(step => step.key === key ? { ...step, done } : step) }); } : undefined} /><button type="button" className="btn full" onClick={() => setStretchContext(null)}>Done</button></DialogContent></Dialog>
      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent className={`app-dialog`}>
          <DialogHeader>
            <DialogTitle>{`Finish your workout`}</DialogTitle>
            <DialogDescription>
              {activeSession?.kind === 'recovery' ? 'Save your recovery time and checked movements.' : activeSession?.kind === 'sport' ? 'Confirm your actual training time and save your reflection.' : `${activeSession?.name ?? ''} · ${activeSession ? completedSets(activeSession) : 0} completed sets. Unchecked sets won’t count.`}
            </DialogDescription>
          </DialogHeader>
          <label className={`field-label`}>
            {`Workout duration · minutes`}
            <input
              type={`number`}
              min={`0.1`}
              max={`10080`}
              step={`0.1`}
              value={finishMinutes}
              onChange={(e) => setFinishMinutes(e.target.value)}
            />
          </label>
          <label className={`field-label`}>
            {`Active calories from your watch · optional`}
            <input
              type={`number`}
              min={`0`}
              max={`20000`}
              placeholder={`Leave blank to use the estimate`}
              value={watchCalories}
              onChange={(e) => setWatchCalories(e.target.value)}
            />
          </label>
          {activeSession && (
            <label className={`field-label`}>
              {`Session intensity`}
              <Select
                value={String(activeSession.met)}
                onValueChange={(e) =>
                  updateSession((t) => ({
                    ...t,
                    met: Number(e),
                  }))
                }
              >
                <SelectTrigger className={`wide-select`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeSession.kind === `strength` ? (
                    <ReactJSX.Fragment>
                      <SelectItem
                        value={`3.5`}
                      >{`Moderate lifting`}</SelectItem>
                      <SelectItem value={`6`}>{`Vigorous lifting`}</SelectItem>
                    </ReactJSX.Fragment>
                  ) : activeSession.kind === `sport` ? (
                    <ReactJSX.Fragment>
                      <SelectItem value={`4`}>{`General practice`}</SelectItem>
                      <SelectItem value={`6`}>{`Competitive play`}</SelectItem>
                    </ReactJSX.Fragment>
                  ) : (
                    <ReactJSX.Fragment>
                      <SelectItem value={`2.3`}>{`Gentle mobility`}</SelectItem>
                      <SelectItem value={`3`}>{`Easy walking`}</SelectItem>
                    </ReactJSX.Fragment>
                  )}
                </SelectContent>
              </Select>
            </label>
          )}
          <button
            className={`btn full`}
            disabled={finishSaving}
            onClick={() => void finishWorkout()}
          >
            {finishSaving ? `Saving workout…` : `Save completed workout`}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className={`app-dialog`}>
          <DialogHeader>
            <DialogTitle>{`Your preferences`}</DialogTitle>
            <DialogDescription>{`Used for new workouts and calorie estimates.`}</DialogDescription>
          </DialogHeader>
          <label className={`field-label`}>
            {`Body weight · kg`}
            <input
              type={`number`}
              min={`20`}
              max={`400`}
              step={`0.1`}
              value={settingsDraft.bodyWeight}
              onChange={(e) =>
                setSettingsDraft((t) => ({
                  ...t,
                  bodyWeight: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className={`field-label`}>
            {`Default rest · seconds`}
            <input
              type={`number`}
              min={`15`}
              max={`600`}
              value={settingsDraft.restSeconds}
              onChange={(e) =>
                setSettingsDraft((t) => ({
                  ...t,
                  restSeconds: Number(e.target.value),
                }))
              }
            />
          </label>
          <details className="settings-estimates"><summary>Calorie estimates</summary>
            <p>{`Active calories are estimated from your body weight, workout duration, and intensity. They are a rough estimate, not a measurement. Rest between sets affects accuracy.`}</p>
            <p>{`You can enter your watch’s active calories when finishing a workout. This app does not read Apple Health.`}</p>
            <a
              href={`https://pacompendium.com/`}
              target={`_blank`}
              rel={`noreferrer`}
            >{`2024 Compendium of Physical Activities`}</a>
          </details>
          <button
            className={`btn full`}
            disabled={!loaded || profileSaving}
            onClick={async () => {
              (await saveProfile({
                ...profile,
                ...settingsDraft,
              })) && setSettingsOpen(!1);
            }}
          >
            {profileSaving ? `Saving…` : `Save preferences`}
          </button>
          <TimerSoundSettings enabled={profile.timerSoundEnabled !== false} volume={profile.timerSoundVolume ?? DEFAULT_REST_VOLUME} disabled={profileSaving || !loaded}
            onChange={timerSoundEnabled => saveProfile({ ...profile, timerSoundEnabled }, { notify: false })}
            onVolumeChange={timerSoundVolume => saveProfile({ ...profile, timerSoundVolume }, { notify: false })}
            audioState={restAudio.audioState} testSound={restAudio.testSound} unlock={restAudio.unlock} />
          <AppearanceSettings value={profile.appearance ?? 'system'} disabled={profileSaving} onChange={appearance => saveProfile({ ...profile, appearance }, { notify: false })} />
          <DataSettings beforeExport={flushPendingWrites} onReplace={replaceLocalData} />
          <button
            className={`text-button`}
            onClick={() => {
              setSettingsOpen(!1);
              setInstallOpen(!0);
            }}
          >{`Add app to your iPhone`}</button>
        </DialogContent>
      </Dialog>
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className={`app-dialog`}>
          <DialogHeader>
            <DialogTitle>{`Setline on your iPhone`}</DialogTitle>
            <DialogDescription>{`Keep your training log one tap away.`}</DialogDescription>
          </DialogHeader>
          <ol className={`install-steps`}>
            <li>
              <span>{`1`}</span>
              {`Open this app in Safari.`}
            </li>
            <li>
              <span>{`2`}</span>
              {`Tap Share, then Add to Home Screen.`}
            </li>
            <li>
              <span>{`3`}</span>
              {`Turn on Open as Web App and tap Add.`}
            </li>
          </ol>
          <p
            className={`small-note`}
          >{`Your workouts and settings are saved on this device and work offline. Use the backup controls in Settings to keep a copy of your data.`}</p>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Discard this workout?`}</AlertDialogTitle>
            <AlertDialogDescription>{`It won’t appear in your completed workout history.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{`Keep workout`}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                activeSession &&
                  (queueSession(
                    stopSessionTimers(activeSession, `cancelled`),
                    !0,
                  ),
                  setRestEndsAt(null));
              }}
            >{`Discard workout`}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={selectedHistory !== null}
        onOpenChange={(e) => {
          e || setSelectedHistory(null);
        }}
      >
        <DialogContent className={`app-dialog history-dialog`}>
          <DialogHeader>
            <DialogTitle>{selectedHistory?.name}</DialogTitle>
            <DialogDescription>
              {selectedHistory
                ? `${WEEKDAYS[selectedHistory.day]}, ${formatDate(selectedHistory.date)} ${selectedHistory.date.slice(0, 4)}`
                : ``}
            </DialogDescription>
          </DialogHeader>
          {selectedHistory && (
            <ReactJSX.Fragment>
              {completedCelebrationId === selectedHistory.id && <WorkoutCompletion session={selectedHistory} sessions={completedSessions} volleyballSchedule={volleyballSchedule} onStretch={() => openStretches(selectedHistory)} onDone={() => setSelectedHistory(null)} />}
              {completedCelebrationId !== selectedHistory.id && <button type="button" className="btn secondary" onClick={() => openStretches(selectedHistory)}>Stretch now</button>}
              {completedCelebrationId !== selectedHistory.id && <div className={`summary-stats`}>
                <span>
                  <strong>
                    {formatNumber(sessionDuration(selectedHistory) / 6e4)}
                  </strong>
                  {`minutes`}
                </span>
                {(selectedHistory.kind !== 'sport' || completedSets(selectedHistory) > 0) && <span>
                  <strong>{selectedHistory.kind === 'recovery' && !selectedHistory.exercises.length ? (selectedHistory.cooldown ?? []).filter(step => step.done).length : completedSets(selectedHistory)}</strong>
                  {selectedHistory.kind === 'recovery' && !selectedHistory.exercises.length ? `movements checked` : `sets`}
                </span>}
                {(selectedHistory.kind === 'strength' || estimatedCalories(selectedHistory.exercises) > 0) && <span>
                  <strong>
                    {formatNumber(estimatedCalories(selectedHistory.exercises))}
                  </strong>
                  {`kg volume`}
                </span>}
                <span>
                  <strong>{getCalories(selectedHistory)}</strong>
                  {`active kcal`}
                  {selectedHistory.watchCalories === null ? ` est.` : ``}
                </span>
              </div>}
              <details className="history-set-details"><summary>Session details</summary>
              {completedCelebrationId === selectedHistory.id && <div className="history-energy"><strong>{getCalories(selectedHistory)}</strong> active kcal{selectedHistory.watchCalories === null ? ' est.' : ''}</div>}
              {selectedHistory.exercises
                .filter((e) => e.logs.some((e) => e.done))
                .map((e) => (
                  <section className={`history-exercise`} key={e.key}>
                    <div>
                      <h3>{e.name}</h3>
                      <span>
                        {formatElapsedTime(formatDuration(e))}
                        {` movement time`}
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{`Set`}</TableHead>
                          <TableHead>{`Weight`}</TableHead>
                          <TableHead>{`Reps`}</TableHead>
                          <TableHead>{`Time`}</TableHead>
                          <TableHead>{`RIR`}</TableHead>
                          {e.measurement && <TableHead>{`cm`}</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {e.logs.map((t, n) =>
                          t.done ? (
                            <TableRow key={t.id}>
                              <TableCell>{n + 1}</TableCell>
                              <TableCell>
                                {t.kg === null
                                  ? `—`
                                  : `${formatNumber(t.kg)} kg`}
                              </TableCell>
                              <TableCell>{t.reps ?? `—`}</TableCell>
                              <TableCell>
                                {t.seconds === null
                                  ? `—`
                                  : `${formatNumber(t.seconds)}s`}
                              </TableCell>
                              <TableCell>{t.rir ?? `—`}</TableCell>
                              {e.measurement && (
                                <TableCell>{t.measurementCm ?? `—`}</TableCell>
                              )}
                            </TableRow>
                          ) : null,
                        )}
                      </TableBody>
                    </Table>
                    {e.perSide && (
                      <p
                        className={`small-note`}
                      >{`Reps and time are entered per side.`}</p>
                    )}
                    <ExerciseGuide exercise={e} />
                  </section>
                ))}
              <PreparationChecklist
                items={preparationFor(selectedHistory, 'warmup')}
                phase={`warmup`}
                kind={selectedHistory.kind}
              />
              <PreparationChecklist
                items={preparationFor(selectedHistory, 'cooldown')}
                phase={`cooldown`}
                kind={selectedHistory.kind}
              />
              {selectedHistory.notes && (
                <div className={`info-box`}>
                  <h3>{`Notes`}</h3>
                  <p>{selectedHistory.notes}</p>
                </div>
              )}
              <ExtraActivities date={selectedHistory.date} bodyWeight={profile.bodyWeight} records={activityRecords} onSave={saveExtraActivity} readOnly />
              </details>
              <button
                className={`btn secondary full`}
                onClick={() => {
                  setEditingHistoryId(selectedHistory.id);
                  setTab(`train`);
                  setWeekStart(
                    startOfWeek(new Date(`${selectedHistory.date}T12:00:00`)),
                  );
                  setSelectedDay(selectedHistory.day);
                  setSelectedHistory(null);
                }}
              >
                <Pencil size={16} />
                {` Edit this log`}
              </button>
              <button
                className={`btn delete-record-button full`}
                disabled={mutatingRecordId !== null}
                onClick={() => {
                  setDeleteCandidate(selectedHistory);
                  setSelectedHistory(null);
                }}
              >{`Delete workout`}</button>
            </ReactJSX.Fragment>
          )}
        </DialogContent>
      </Dialog>
      <WorkoutBuilder open={editingDay !== null} onOpenChange={open => { if (!open) { setEditingDay(null); setPlanDraft(null); } }}
        initialWorkout={planDraft} title={`Edit ${editingExtraSession ? 'primer' : WEEKDAYS[editingDay] ?? 'day'}`} submitLabel="Save day"
        onSave={async workout => {
          if (editingDay === null) return false;
          const saved = await saveBaseWeek(editableWeekPlan.map((day, index) => index === editingDay
            ? editingExtraSession ? { ...day, extraSession: workout } : { ...workout, ...(day.extraSession ? { extraSession: day.extraSession } : {}) } : day));
          if (saved) { setEditingDay(null); setPlanDraft(null); }
          return saved;
        }} />
      <WorkoutBuilder open={customBuilder !== null} onOpenChange={open => { if (!open) setCustomBuilder(null); }}
        initialWorkout={customBuilder?.workout} title={customBuilder?.id ? 'Edit workout' : 'Create workout'} onSave={saveCustomWorkout} />
      <Dialog open={workoutChooserOpen} onOpenChange={setWorkoutChooserOpen}><DialogContent className="app-dialog workout-chooser">
        <DialogHeader><DialogTitle>Choose workout</DialogTitle><DialogDescription>Use a saved session for {formatDate(selectedDate)}.</DialogDescription></DialogHeader>
        {(profile.customWorkouts ?? []).map(workout => <button key={workout.id} className="saved-workout-row" disabled={saving || !!activeSession || !!editingHistoryId} aria-label={`Start ${workout.name}`} onClick={() => void startCustomWorkout(workout)}><span><strong>{workout.name}</strong><span>{workout.exercises.length} exercises · {workout.minutes} min</span></span><Play size={18} /></button>)}
        {!(profile.customWorkouts ?? []).length && <p className="muted">Create a workout to use it here.</p>}
        {(activeSession || editingHistoryId) && <p className="muted">Finish your current workout first.</p>}
        <button className="btn secondary full" onClick={() => { setWorkoutChooserOpen(false); openCustomWorkout(); }}><Plus size={18} /> Create workout</button>
      </DialogContent></Dialog>
      <AlertDialog open={resetPlanOpen} onOpenChange={setResetPlanOpen}><AlertDialogContent className="app-dialog"><AlertDialogHeader><AlertDialogTitle>Restore recommended plan?</AlertDialogTitle><AlertDialogDescription>Your saved workouts, history and preferences stay. The weekly plan returns to its recommended schedule.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep my plan</AlertDialogCancel><AlertDialogAction disabled={profileSaving} onClick={async event => { event.preventDefault(); if (await saveProfile(profile.masterProgram ? { ...profile, plan: createRecommendedMasterPlan(profile.masterProgram), masterMatchWeekend: createRecommendedMasterPlan(profile.masterProgram, true).slice(5) } : resetRecommendedPlan(profile))) setResetPlanOpen(false); }}>Restore plan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </Tabs>
  );
}
/** Derive useful guides without rewriting a saved plan or session on read. */
function preparationFor(source, phase) {
  return getSessionPreparation({ phase, kind: source.kind, exercises: source.exercises.filter(exercise => !exercise.optionalWork),
    items: source[phase], name: source.name, goal: source.goal, minutes: source.minutes ?? source.plannedMinutes, programRevision: source.programRevision });
}
function SessionExerciseArea({ sport, editing, children }) {
  return sport ? <details className="sport-tracking" open={editing || undefined}><summary>Training log</summary>{children}</details> : <>{children}</>;
}
function PreparationChecklist({
  items: items,
  phase: phase,
  kind: kind,
  onToggle: onToggle,
  compact = !1,
  defaultOpen = false,
}) {
  if (!items?.length) return null;
  let a = kind === `recovery`;
  let o =
    phase === `warmup`
      ? `Dynamic warm-up`
      : a
        ? `Recovery mobility & stretching`
        : `Cool-down & stretching`;
  let s = phase === `warmup` ? `8–12 min` : `5–8 min`;
  let c = items.filter((e) => e.done).length;
  return (
    <Accordion
      type={`single`}
      collapsible={!0}
      defaultValue={defaultOpen || (!compact && phase === `warmup`) ? `routine` : void 0}
      className={`routine-panel`}
    >
      <AccordionItem value={`routine`}>
        <AccordionTrigger>
          <span>
            <strong>{o}</strong>
            <span className={`routine-meta`}>
              {s}
              {onToggle || c ? ` · ${c}/${items.length} done` : ``}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className={`routine-note`}>
            {phase === `warmup`
              ? `Build up gradually with easy movements and light practice sets. Finish ready, not tired.`
              : `Gentle holds on both sides. Stop if it hurts.`}
          </p>
          <ol className={`routine-steps`}>
            {items.map((e, n) => (
              <li className={e.done ? `routine-done` : ``} key={e.key}>
                {onToggle ? (
                  <Checkbox
                    checked={e.done}
                    aria-label={`Complete ${e.name} in ${phase}`}
                    onCheckedChange={(t) => onToggle(e.key, t === !0)}
                  />
                ) : (
                  <span className={`routine-number`}>
                    {e.done ? <Check size={16} /> : n + 1}
                  </span>
                )}
                <div>
                  <strong>{e.name}</strong>
                  <span className={`routine-target`}>{e.target}</span>
                  {e.cue && <p>{e.cue}</p>}
                  <ExerciseGuide exercise={e} compact />
                </div>
              </li>
            ))}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
function PlanDayDetails({ plan: plan }) {
  return (
    <ReactJSX.Fragment>
      <h2>{shortSessionName(plan.name)}</h2>
      <p className={`muted`}>
        {`About `}
        {plan.minutes}
        {` min · `}
        {plan.exercises.filter(exercise => !exercise.optionalWork).reduce((e, t) => e + t.sets, 0)}
        {` sets`}
      </p>
      <ul>
        {plan.exercises.filter(exercise => !exercise.optionalWork).map((e) => (
          <li key={e.key}>
            <div>
              <span>{e.name}</span>
              {e.cue && <p className={`exercise-cue`}>{e.cue}</p>}
              <ExerciseGuide exercise={e} compact />
              <p className={`small-note`}>
                {e.rest ? `Rest ${e.rest}s` : `No set rest`}
                {e.measurement ? ` · ${measurementLabel(e)}` : ``}
              </p>
            </div>
            <span>
              {e.sets}
              {` × `}
              {e.target}
              {e.perSide ? ` / side` : ``}
            </span>
          </li>
        ))}
      </ul>
      {plan.exercises.some(exercise => exercise.optionalWork) && <details><summary>Optional work</summary><ul>{plan.exercises.filter(exercise => exercise.optionalWork).map(exercise => <li key={exercise.key}>{exercise.name} · {exercise.sets} × {exercise.target}</li>)}</ul></details>}
      <p className={`plan-note`}>{plan.note}</p>
      <PreparationChecklist
        items={preparationFor(plan, 'warmup')}
        phase={`warmup`}
        kind={plan.kind}
        compact={!0}
      />
      <PreparationChecklist
        items={preparationFor(plan, 'cooldown')}
        phase={`cooldown`}
        kind={plan.kind}
        compact={!0}
      />
    </ReactJSX.Fragment>
  );
}
function MetricCard({
  icon: icon,
  label: label,
  value: value,
  loaded: loaded,
}) {
  return (
    <div className={`stat`}>
      <span>
        {icon}
        {label}
      </span>
      {loaded ? (
        <strong>{value}</strong>
      ) : (
        <Skeleton className={`stat-skeleton`} />
      )}
    </div>
  );
}
function ExerciseTracker({
  exercise: exercise,
  index: index,
  now: now,
  last: last,
  editing: editing,
  onSet: onSet,
  onDone: onDone,
  onTimer: onTimer,
  onAdd: onAdd,
  onRemove: onRemove,
  defaultExpanded = false,
}) {
  let [expanded, setExpanded] = React.useState(defaultExpanded || index === 0);
  let [removeConfirmationOpen, setRemoveConfirmationOpen] = React.useState(!1);
  let invalidWeightInputs = React.useRef(new Set());
  let doneCount = exercise.logs.filter((e) => e.done).length;
  let bestCurrentSet = topSet(exercise);
  let bestPreviousSet = topSet(last?.exercise);
  let weightDelta =
    bestCurrentSet && bestPreviousSet
      ? (bestCurrentSet.kg ?? 0) - (bestPreviousSet.kg ?? 0)
      : null;
  let timedInMinutes =
    exercise.mode === `timed` && exercise.target.includes(`min`);
  let previousLogs = last?.exercise.logs.filter((e) => e.done) ?? [];
  return (
    <section
      className={`exercise-card ${doneCount === exercise.logs.length ? `exercise-complete` : ``}`}
    >
      <button
        className={`exercise-heading`}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`exercise-number`}>
          {doneCount === exercise.logs.length ? (
            <Check size={17} />
          ) : (
            String(index + 1).padStart(2, `0`)
          )}
        </span>
        <div>
          <h3>{exercise.name}</h3>
          <p>
            {exercise.logs.length}
            {` sets × `}
            {exercise.target}
            {exercise.perSide ? ` / side` : ``}
            <span>
              {` · `}
              {exercise.group}
            </span>
          </p>
        </div>
        <span className={`set-badge`}>
          {doneCount}
          {`/`}
          {exercise.logs.length}
        </span>
        <ChevronRight size={17} className={expanded ? `rotated` : ``} />
      </button>
      {expanded && (
        <div className={`exercise-body`}>
          {exercise.cue && <p className={`exercise-cue`}>{exercise.cue}</p>}
          <ExerciseGuide exercise={exercise} />
          {exercise.measurement && (
            <p className={`small-note`}>
              {measurementLabel(exercise)}
              {` · optional, best jump in each set`}
            </p>
          )}
          <div className={`exercise-reference`}>
            <span>
              <RotateCcwClock size={14} />
              {last
                ? `${formatDate(last.session.date, !0)} · ${bestPreviousSet ? `${formatNumber(bestPreviousSet.kg)} kg × ${bestPreviousSet.reps}` : `${previousLogs.length} sets`}`
                : `No previous workout yet`}
            </span>
            {weightDelta !== null && (
              <span className={`delta ${weightDelta > 0 ? `positive` : ``}`}>
                {weightDelta > 0 ? `+` : ``}
                {formatNumber(weightDelta)}
                {` kg vs last`}
              </span>
            )}
          </div>
          <Table className={`log-table`}>
            <TableHeader>
              <TableRow>
                <TableHead>{`Set`}</TableHead>
                <TableHead>{`Last time`}</TableHead>
                {!exercise.measurement && exercise.mode !== `timed` && (
                  <TableHead>
                    {`kg`}
                    {exercise.mode === `bodyweight` ? ` +` : ``}
                  </TableHead>
                )}
                <TableHead>
                  {exercise.mode === `timed`
                    ? timedInMinutes
                      ? `min`
                      : `sec`
                    : exercise.quantityUnit ?? `reps`}
                </TableHead>
                {exercise.measurement && <TableHead>{`cm`}</TableHead>}
                <TableHead className={`done-head`}>{`Done`}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exercise.logs.map((t, n) => {
                let r = previousLogs[n];
                return (
                  <TableRow className={t.done ? `set-done` : ``} key={t.id}>
                    <TableCell className={`set-index`}>{n + 1}</TableCell>
                    <TableCell className={`last-set`}>
                      {r
                        ? exercise.measurement
                          ? r.measurementCm == null
                            ? `${r.reps ?? `—`} reps`
                            : `${formatNumber(r.measurementCm)} cm`
                          : exercise.mode === `timed`
                            ? `${formatNumber((r.seconds ?? 0) / (timedInMinutes ? 60 : 1))}${timedInMinutes ? `m` : `s`}`
                            : `${r.kg === null ? `BW` : formatNumber(r.kg)} × ${r.reps ?? `—`}`
                        : `—`}
                    </TableCell>
                    {!exercise.measurement && exercise.mode !== `timed` && (
                      <TableCell>
                        <DecimalWeightInput
                          placeholder={
                            exercise.mode === `bodyweight` ? `BW` : `—`
                          }
                          label={`${exercise.name} set ${n + 1} weight in kilograms`}
                          value={t.kg}
                          onValidityChange={(valid) => {
                            valid
                              ? invalidWeightInputs.current.delete(t.id)
                              : invalidWeightInputs.current.add(t.id);
                          }}
                          onChange={(kg, valid) =>
                            onSet(t.id, {
                              kg,
                              ...(!valid ? { done: !1 } : {}),
                            })
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <input
                        className={`set-input`}
                        type={`number`}
                        min={`0`}
                        max={
                          exercise.mode === `timed`
                            ? timedInMinutes
                              ? 1440
                              : 86400
                            : 1e3
                        }
                        step={timedInMinutes ? `0.1` : `1`}
                        inputMode={timedInMinutes ? `decimal` : `numeric`}
                        placeholder={exercise.target.match(/\d+/)?.[0] ?? `—`}
                        aria-label={`${exercise.name} set ${n + 1} ${exercise.mode === `timed` ? (timedInMinutes ? `minutes` : `seconds`) : exercise.quantityUnit === `m` ? `distance in metres` : `reps`}`}
                        value={
                          exercise.mode === `timed`
                            ? t.seconds === null
                              ? ``
                              : formatNumber(
                                  t.seconds / (timedInMinutes ? 60 : 1),
                                ).replace(/,/g, ``)
                            : (t.reps ?? ``)
                        }
                        onChange={(n) => {
                          let r = parseAmount(
                            n.target.value,
                            exercise.mode === `timed`
                              ? timedInMinutes
                                ? 1440
                                : 86400
                              : 1e3,
                          );
                          onSet(
                            t.id,
                            exercise.mode === `timed`
                              ? {
                                  seconds:
                                    r === null
                                      ? null
                                      : r * (timedInMinutes ? 60 : 1),
                                }
                              : {
                                  reps: r === null ? null : Math.trunc(r),
                                },
                          );
                        }}
                      />
                    </TableCell>
                    {exercise.measurement && (
                      <TableCell>
                        <input
                          className={`set-input`}
                          type={`number`}
                          min={`0`}
                          max={`1000`}
                          step={`0.1`}
                          inputMode={`decimal`}
                          placeholder={`—`}
                          aria-label={`${exercise.name} set ${n + 1} ${measurementLabel(exercise)}`}
                          value={t.measurementCm ?? ``}
                          onChange={(e) =>
                            onSet(t.id, {
                              measurementCm: parseAmount(e.target.value, 1e3),
                            })
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell className={`done-cell`}>
                      <Checkbox
                        className={`set-check`}
                        checked={t.done}
                        aria-label={`Complete ${exercise.name} set ${n + 1}`}
                        onCheckedChange={(e) => {
                          if (e === !0 && invalidWeightInputs.current.has(t.id)) {
                            toast.error(`Enter a weight between 0 and 2,000 kg using . or ,`);
                            return;
                          }
                          onDone(t.id, e === !0);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {removeConfirmationOpen && (
            <div className={`set-details`}>
              <p className={`small-note`}>
                {`RIR = reps left in reserve. Time is in seconds`}
                {exercise.perSide ? `, per side` : ``}
                {`.`}
              </p>
              {exercise.logs.map((e, t) => (
                <div key={e.id}>
                  <span>
                    {`Set `}
                    {t + 1}
                  </span>
                  <label>
                    {`Time`}
                    <input
                      type={`number`}
                      inputMode={`numeric`}
                      min={`0`}
                      max={`86400`}
                      placeholder={`sec`}
                      value={e.seconds ?? ``}
                      onChange={(t) =>
                        onSet(e.id, {
                          seconds: parseAmount(t.target.value, 86400),
                        })
                      }
                    />
                  </label>
                  <label>
                    {`RIR`}
                    <input
                      type={`number`}
                      inputMode={`numeric`}
                      min={`0`}
                      max={`10`}
                      placeholder={`0–10`}
                      value={e.rir ?? ``}
                      onChange={(t) =>
                        onSet(e.id, {
                          rir: parseAmount(t.target.value, 10),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
          <div className={`exercise-tools`}>
            <div>
              <button
                className={`text-button`}
                disabled={exercise.logs.length >= 30}
                onClick={onAdd}
              >
                <Plus size={14} />
                {` Add set`}
              </button>
              <button
                className={`text-button muted`}
                onClick={() =>
                  setRemoveConfirmationOpen(!removeConfirmationOpen)
                }
              >
                {removeConfirmationOpen ? `Hide` : `Time & RIR`}
              </button>
              {exercise.logs.length > 1 && (
                <button
                  className={`text-button muted`}
                  aria-label={`Remove last set of ${exercise.name}`}
                  onClick={onRemove}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              className={`movement-timer ${exercise.runningSince === null ? `` : `running`}`}
              disabled={editing}
              onClick={onTimer}
              aria-label={`${exercise.runningSince === null ? `Start` : `Stop`} timer for ${exercise.name}`}
            >
              <Timer size={15} />
              <span>{formatElapsedTime(formatDuration(exercise, now))}</span>
              {!editing &&
                (exercise.runningSince === null ? (
                  <Play size={13} />
                ) : (
                  <Pause size={13} />
                ))}
            </button>
          </div>
          {last && (
            <p className={`small-note side-note`}>
              {`Last movement time: `}
              {formatElapsedTime(formatDuration(last.exercise))}
              {` · `}
              {previousLogs.length}
              {` sets.`}
            </p>
          )}
          {exercise.perSide && (
            <p
              className={`small-note side-note`}
            >{`Enter reps or time per side. Use a consistent weight convention each session.`}</p>
          )}
        </div>
      )}
    </section>
  );
}
function ExerciseEditor({
  exercise: exercise,
  onChange: onChange,
  onRemove: onRemove,
}) {
  return (
    <div className={`plan-exercise-editor`}>
      <div className={`edit-exercise-name`}>
        <label className={`field-label`}>
          {`Movement`}
          <input
            value={exercise.name}
            maxLength={120}
            onChange={(n) =>
              onChange({
                ...exercise,
                name: n.target.value,
                key:
                  n.target.value
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, `-`)
                    .slice(0, 110) || exercise.key,
              })
            }
          />
        </label>
        <button
          className={`icon-button`}
          aria-label={`Remove ${exercise.name}`}
          onClick={onRemove}
        >
          <X size={18} />
        </button>
      </div>
      <div className={`exercise-editor-grid`}>
        <label className={`field-label`}>
          {`Sets`}
          <input
            type={`number`}
            min={`1`}
            max={`20`}
            value={exercise.sets}
            onChange={(n) =>
              onChange({
                ...exercise,
                sets: Number(n.target.value),
              })
            }
          />
        </label>
        <label className={`field-label`}>
          {`Target`}
          <input
            maxLength={60}
            value={exercise.target}
            onChange={(n) =>
              onChange({
                ...exercise,
                target: n.target.value,
              })
            }
          />
        </label>
        <label className={`field-label`}>
          {`Rest · sec`}
          <input
            type={`number`}
            min={`0`}
            max={`600`}
            value={exercise.rest}
            onChange={(n) =>
              onChange({
                ...exercise,
                rest: Number(n.target.value),
              })
            }
          />
        </label>
        <label className={`field-label`}>
          {`Logging`}
          <Select
            value={exercise.mode}
            onValueChange={(n) =>
              onChange({
                ...exercise,
                mode: n,
              })
            }
          >
            <SelectTrigger className={`wide-select`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={`weight`}>{`Weight + reps`}</SelectItem>
              <SelectItem
                value={`bodyweight`}
              >{`Bodyweight + reps`}</SelectItem>
              <SelectItem value={`timed`}>{`Time`}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <label className={`field-label`}>
        {`Technique / pairing notes`}
        <textarea
          maxLength={500}
          value={exercise.cue ?? ``}
          onChange={(n) =>
            onChange({
              ...exercise,
              cue: n.target.value,
            })
          }
        />
      </label>
      <label className={`checkbox-label`}>
        <Checkbox
          checked={exercise.perSide}
          onCheckedChange={(n) =>
            onChange({
              ...exercise,
              perSide: n === !0,
            })
          }
        />
        {` Reps / time are per side`}
      </label>
    </div>
  );
}
var formatNumber = (e) =>
  new Intl.NumberFormat(`en-GB`, {
    maximumFractionDigits: 1,
  }).format(e);
var parseAmount = (e, t = 2e3) =>
  e.trim() === ``
    ? null
    : Math.min(t, Math.max(0, Number(e.replace(`,`, `.`)) || 0));
var sessionKindLabel = (e) =>
  e === `strength` ? `Gym` : e === `sport` ? `Volleyball` : `Recovery`;
var SessionKindIcon = ({ kind: e, ...t }) =>
  e === `strength` ? (
    <Dumbbell {...t} />
  ) : e === `sport` ? (
    <Activity {...t} />
  ) : (
    <Leaf {...t} />
  );
export default GymApp;
