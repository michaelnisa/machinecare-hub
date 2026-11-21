import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../config/supabase";
import { colors, radii, spacing } from "../../theme";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import {
  Truck,
  QrCode,
  ClipboardCheck,
  Receipt,
  Radio,
  MapPin,
  Wallet,
  Gauge,
  AlertTriangle,
  ChevronRight,
  Play,
  CheckCircle2,
  Calendar,
  Clock,
  Box,
  Plus,
  Coins,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  X,
} from "lucide-react-native";

interface DriverHomeScreenProps {
  onNavigate: (screen: string) => void;
}

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ onNavigate }) => {
  const { driverVehicle, pairDriverVehicle, unpairDriverVehicle, user, organisation } = useAuth();
  const [activeTrip, setActiveTrip] = useState<any | null>(null);
  const [pendingTrip, setPendingTrip] = useState<any | null>(null);
  const [tripExpenses, setTripExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Milestone Modal State
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneOdo, setMilestoneOdo] = useState("");
  const [savingMilestone, setSavingMilestone] = useState(false);

  // Complete Trip Modal State
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [finalOdo, setFinalOdo] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [completingTrip, setCompletingTrip] = useState(false);

  // Start Assigned Trip Modal State
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startingOdo, setStartingOdo] = useState("");
  const [startingTrip, setStartingTrip] = useState(false);

  const loadDriverData = async () => {
    try {
      setLoading(true);

      // 1. Resolve Driver ID if user has driver record
      let resolvedDriverId: string | null = null;
      if (user?.email || user?.phone) {
        const { data: dData } = await supabase
          .from("drivers")
          .select("id, full_name, phone, licence_number")
          .or(`email.ilike.%${user.email || ""}%${user.phone ? `,phone.ilike.%${user.phone}%` : ""}`)
          .limit(1)
          .maybeSingle();

        if (dData) resolvedDriverId = dData.id;
      }

      // 2. Query Active & Dispatched Trips
      let tripQuery = supabase
        .from("trips")
        .select(`
          id,
          machine_id,
          driver_id,
          status,
          start_at,
          end_at,
          start_odo,
          end_odo,
          origin,
          destination,
          cargo_description,
          client_name,
          client_order_no,
          route_notes,
          cost,
          organisation_id,
          machines:machine_id (
            id,
            name,
            plate_number,
            registration_number,
            trailer_plate,
            make,
            model,
            current_odometer_km,
            status,
            organisation_id
          )
        `);

      if (resolvedDriverId && driverVehicle?.vehicleId) {
        tripQuery = tripQuery.or(`driver_id.eq.${resolvedDriverId},machine_id.eq.${driverVehicle.vehicleId}`);
      } else if (driverVehicle?.vehicleId) {
        tripQuery = tripQuery.eq("machine_id", driverVehicle.vehicleId);
      } else if (resolvedDriverId) {
        tripQuery = tripQuery.eq("driver_id", resolvedDriverId);
      } else if (organisation?.id) {
        tripQuery = tripQuery.eq("organisation_id", organisation.id);
      }

      const { data: tripResults, error: tripErr } = await tripQuery
        .in("status", ["in_progress", "active", "dispatched", "pending"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (tripErr) console.warn("Trip query error:", tripErr);

      if (tripResults && tripResults.length > 0) {
        // Find ongoing in_progress trip
        const ongoing = tripResults.find(
          (t) => t.status === "in_progress" || t.status === "active"
        );
        const dispatched = tripResults.find(
          (t) => t.status === "dispatched" || t.status === "pending"
        );

        if (ongoing) {
          let meta: any = {};
          if (ongoing.cargo_description?.startsWith("{")) {
            try {
              meta = JSON.parse(ongoing.cargo_description);
            } catch {}
          }
          setActiveTrip({ ...ongoing, meta });
          setPendingTrip(null);

          // Auto couple vehicle if driver is not coupled yet
          if (!driverVehicle && ongoing.machines) {
            const m = ongoing.machines as any;
            await pairDriverVehicle({
              vehicleId: m.id,
              plateNumber: m.plate_number || m.name,
              vehicleCode: m.registration_number || "TRK",
              registrationNumber: m.registration_number,
              name: m.name,
              makeModel: [m.make, m.model].filter(Boolean).join(" "),
              linkedTrailerPlate: m.trailer_plate,
              odometerKm: m.current_odometer_km,
              organisationId: m.organisation_id,
              pairedAt: new Date().toISOString(),
            });
          }

          // Fetch itemized expenses for this trip
          const { data: expData } = await (supabase as any)
            .from("trip_expenses")
            .select("id, expense_type, title, amount, currency, reference_number, occurred_at")
            .eq("trip_id", ongoing.id)
            .order("occurred_at", { ascending: false })
            .limit(10);

          setTripExpenses(expData || []);
        } else if (dispatched) {
          setActiveTrip(null);
          setPendingTrip(dispatched);
          setTripExpenses([]);
        } else {
          setActiveTrip(null);
          setPendingTrip(null);
          setTripExpenses([]);
        }
      } else {
        setActiveTrip(null);
        setPendingTrip(null);
        setTripExpenses([]);
      }
    } catch (e) {
      console.warn("Failed to load driver data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, [driverVehicle?.vehicleId, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDriverData();
  };

  // 1. Action: Start Assigned Trip
  const handleStartTrip = async () => {
    if (!pendingTrip) return;
    const startKm = Number(startingOdo) || pendingTrip.start_odo || pendingTrip.machines?.current_odometer_km || 0;

    try {
      setStartingTrip(true);
      const { error } = await supabase
        .from("trips")
        .update({
          status: "in_progress",
          start_at: new Date().toISOString(),
          start_odo: startKm,
        })
        .eq("id", pendingTrip.id);

      if (error) throw error;

      // Auto couple the trip's machine
      if (pendingTrip.machines) {
        const m = pendingTrip.machines as any;
        await pairDriverVehicle({
          vehicleId: m.id,
          plateNumber: m.plate_number || m.name,
          vehicleCode: m.registration_number || "TRK",
          registrationNumber: m.registration_number,
          name: m.name,
          makeModel: [m.make, m.model].filter(Boolean).join(" "),
          linkedTrailerPlate: m.trailer_plate,
          odometerKm: startKm,
          organisationId: m.organisation_id,
          pairedAt: new Date().toISOString(),
        });
      }

      setStartModalOpen(false);
      Alert.alert("Safari Imeanza! (Trip Started)", "Safari imefunguliwa na taarifa zimesasishwa kwa dispatch.");
      loadDriverData();
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Failed to start trip.");
    } finally {
      setStartingTrip(false);
    }
  };

  // 2. Action: Log Milestone Checkpoint
  const handleSaveMilestone = async () => {
    if (!activeTrip || !milestoneName.trim()) {
      Alert.alert("Ingiza Kituo", "Tafadhali andika jina la kituo (mf. Mizani ya Vigwaza).");
      return;
    }

    try {
      setSavingMilestone(true);
      const currentNotes = activeTrip.route_notes || "";
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const newEntry = `[${timestamp}] Checkpoint: ${milestoneName.trim()} (ODO: ${milestoneOdo || "N/A"})`;
      const updatedNotes = currentNotes ? `${currentNotes}\n${newEntry}` : newEntry;

      const { error } = await supabase
        .from("trips")
        .update({ route_notes: updatedNotes })
        .eq("id", activeTrip.id);

      if (error) throw error;

      // If odo is higher, update machine
      if (milestoneOdo && Number(milestoneOdo) > 0 && activeTrip.machine_id) {
        await supabase
          .from("machines")
          .update({ current_odometer_km: Number(milestoneOdo) })
          .eq("id", activeTrip.machine_id);
      }

      setMilestoneModalOpen(false);
      setMilestoneName("");
      setMilestoneOdo("");
      Alert.alert("Kituo Kimerekodiwa", "Taarifa ya eneo na kilometa imetumwa kwa wasimamizi wa safari.");
      loadDriverData();
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Failed to record milestone.");
    } finally {
      setSavingMilestone(false);
    }
  };

  // 3. Action: Complete & Surrender Trip
  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    const endKm = Number(finalOdo) || activeTrip.machines?.current_odometer_km || 0;

    try {
      setCompletingTrip(true);
      const { error } = await supabase
        .from("trips")
        .update({
          status: "completed",
          end_at: new Date().toISOString(),
          end_odo: endKm,
          route_notes: `${activeTrip.route_notes || ""}\n[TRIP CLOSED] End ODO: ${endKm} km. Notes: ${closingNotes || "Trip delivered safely."}`.trim(),
        })
        .eq("id", activeTrip.id);

      if (error) throw error;

      if (endKm > 0 && activeTrip.machine_id) {
        await supabase
          .from("machines")
          .update({ current_odometer_km: endKm })
          .eq("id", activeTrip.machine_id);
      }

      setCompleteModalOpen(false);
      setFinalOdo("");
      setClosingNotes("");
      Alert.alert(
        "Hongera! Safari Imekamilika",
        "Safari imefungwa kikamilifu. Hesabu ya risiti na posho imetumwa kwa Mhasibu (Finance)."
      );
      loadDriverData();
    } catch (e: any) {
      Alert.alert("Hitilafu", e.message || "Failed to complete trip.");
    } finally {
      setCompletingTrip(false);
    }
  };

  // Calculations for Posho Wallet
  const floatAllocated = activeTrip?.cost || activeTrip?.meta?.safari_float?.total_advance || 450000;
  const totalExpensesLogged = tripExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remainingCashBalance = Math.max(0, floatAllocated - totalExpensesLogged);
  const floatUsedPct = Math.min(100, Math.round((totalExpensesLogged / (floatAllocated || 1)) * 100));

  const driverDisplayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Dereva";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Driver Greeting Banner */}
      <View style={styles.greetingHeader}>
        <View style={styles.driverAvatar}>
          <UserCheck size={24} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingSub}>Habari ya Safari, (Welcome)</Text>
          <Text style={styles.greetingName}>{driverDisplayName}</Text>
        </View>
        <View style={styles.orgBadge}>
          <Text style={styles.orgBadgeText}>{organisation?.name || "LOGISTIXWARE"}</Text>
        </View>
      </View>

      {/* 1. Coupled Vehicle Card */}
      {driverVehicle ? (
        <Card variant="highlight" style={styles.truckCard}>
          <View style={styles.truckHeader}>
            <View style={styles.truckLeft}>
              <View style={styles.truckIconCircle}>
                <Truck size={24} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.truckPlate}>{driverVehicle.plateNumber || driverVehicle.name}</Text>
                <Text style={styles.truckCode}>
                  ID: {driverVehicle.vehicleCode} · {driverVehicle.makeModel || "Commercial Hauler"}
                </Text>
              </View>
            </View>
            <StatusBadge status="running" label="COUPLED" />
          </View>

          {driverVehicle.linkedTrailerPlate && (
            <View style={styles.trailerRow}>
              <Text style={styles.trailerLabel}>Coupled Trailer:</Text>
              <Text style={styles.trailerValue}>{driverVehicle.linkedTrailerPlate}</Text>
            </View>
          )}

          <View style={styles.truckStatsRow}>
            <View style={styles.truckStatItem}>
              <Gauge size={14} color={colors.textMuted} />
              <Text style={styles.statLabel}>Current ODO:</Text>
              <Text style={styles.statValue}>
                {driverVehicle.odometerKm ? `${driverVehicle.odometerKm.toLocaleString()} km` : "Ready"}
              </Text>
            </View>
            <TouchableOpacity onPress={unpairDriverVehicle} style={styles.unpairBtn}>
              <Text style={styles.unpairText}>Switch Truck</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : (
        <TouchableOpacity
          style={styles.pairPromptCard}
          onPress={() => onNavigate("QrTruckSignIn")}
          activeOpacity={0.8}
        >
          <View style={styles.pairIconBox}>
            <QrCode size={30} color={colors.primary} />
          </View>
          <View style={styles.pairPromptTextContainer}>
            <Text style={styles.pairPromptTitle}>Scan Truck QR Code to Couple</Text>
            <Text style={styles.pairPromptSub}>
              Piga picha QR Code ya gari au trela kuanza kazi na kufungua safari.
            </Text>
          </View>
          <ChevronRight size={20} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* 2. Pending / Dispatched Trip Awaiting Start */}
      {pendingTrip && !activeTrip && (
        <Card style={styles.pendingCard}>
          <View style={styles.pendingHeader}>
            <View style={styles.pendingBadge}>
              <Calendar size={12} color={colors.amber} />
              <Text style={styles.pendingBadgeText}>SAFARI MPYA IMEPANGWA (DISPATCHED)</Text>
            </View>
            <StatusBadge status="pending" label="READY TO START" />
          </View>

          <Text style={styles.tripRoute}>
            {pendingTrip.origin || "Dar es Salaam Port"} ➔ {pendingTrip.destination || "Destination"}
          </Text>

          <View style={styles.cargoInfoBox}>
            <Box size={14} color={colors.textMuted} />
            <Text style={styles.cargoInfoText}>
              Mzigo: {pendingTrip.cargo_description || "Commercial Dry Cargo / Container"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.startTripBtn}
            onPress={() => {
              setStartingOdo(String(pendingTrip.machines?.current_odometer_km || ""));
              setStartModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Play size={16} color="#FFF" />
            <Text style={styles.startTripBtnText}>Anza Safari Hii Sasa (Start Trip)</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* 3. Active Trip Corridor Hero Card */}
      {activeTrip ? (
        <Card style={styles.tripCard}>
          {/* Trip Header */}
          <View style={styles.tripHeader}>
            <View style={styles.tripTag}>
              <MapPin size={13} color={colors.blue} />
              <Text style={styles.tripTagText}>SAFARI INAYOENDELEA (EN ROUTE)</Text>
            </View>
            <StatusBadge status="in_progress" label="EN ROUTE" />
          </View>

          {/* Corridor Origin -> Destination */}
          <View style={styles.corridorContainer}>
            <Text style={styles.corridorCities}>
              {activeTrip.origin || "Origin Yard"} ➔ {activeTrip.destination || "Destination Depot"}
            </Text>
            {activeTrip.client_name ? (
              <Text style={styles.clientSubtitle}>
                Mteja: {activeTrip.client_name} {activeTrip.client_order_no ? `(Order #${activeTrip.client_order_no})` : ""}
              </Text>
            ) : null}
          </View>

          {/* Cargo & Start Odometer */}
          <View style={styles.tripMetaRow}>
            <View style={styles.tripMetaItem}>
              <Box size={13} color={colors.textMuted} />
              <Text style={styles.tripMetaText} numberOfLines={1}>
                {activeTrip.cargo_description || "Commercial Cargo"}
              </Text>
            </View>
            <View style={styles.tripMetaItem}>
              <Gauge size={13} color={colors.textMuted} />
              <Text style={styles.tripMetaText}>
                Start: {activeTrip.start_odo ? `${activeTrip.start_odo.toLocaleString()} km` : "N/A"}
              </Text>
            </View>
          </View>

          {/* Safari Float & Posho Wallet */}
          <View style={styles.walletBox}>
            <View style={styles.walletHeader}>
              <View style={styles.walletTitleRow}>
                <Wallet size={16} color={colors.amber} />
                <Text style={styles.walletTitle}>Safari Cash Float & Posho (Mkoba wa Safari)</Text>
              </View>
              <Text style={styles.walletSurrender}>Float Surrender</Text>
            </View>

            <View style={styles.walletValuesRow}>
              <View>
                <Text style={styles.walletSubLabel}>Fedha Mfukoni (Balance)</Text>
                <Text style={styles.walletBalanceText}>
                  TZS {remainingCashBalance.toLocaleString()}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.walletSubLabel}>Risiti Zilizopigwa</Text>
                <Text style={styles.walletSpentText}>
                  TZS {totalExpensesLogged.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Float usage progress bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${floatUsedPct}%` }]} />
            </View>
            <Text style={styles.floatHelperText}>
              {floatUsedPct}% ya posho/advance imetumika • Jumla ya Float: TZS {floatAllocated.toLocaleString()}
            </Text>
          </View>

          {/* Recent Receipts List */}
          <View style={styles.receiptsHeader}>
            <Text style={styles.receiptsTitle}>Risiti za Safari ({tripExpenses.length})</Text>
            <TouchableOpacity
              onPress={() => onNavigate("ReceiptSnapper")}
              style={styles.addReceiptBtn}
            >
              <Plus size={13} color={colors.primary} />
              <Text style={styles.addReceiptText}>Piga Risiti Mpya</Text>
            </TouchableOpacity>
          </View>

          {tripExpenses.length === 0 ? (
            <View style={styles.emptyReceipts}>
              <Text style={styles.emptyReceiptsText}>
                Bado haujaweka risiti ya mzani, mafuta, au tozo kwa safari hii.
              </Text>
            </View>
          ) : (
            <View style={styles.receiptsList}>
              {tripExpenses.slice(0, 3).map((exp) => (
                <View key={exp.id} style={styles.receiptRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptRowTitle}>{exp.title}</Text>
                    <Text style={styles.receiptRowMeta}>
                      [{exp.expense_type?.toUpperCase()}] • {new Date(exp.occurred_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.receiptRowAmt}>
                    TZS {Number(exp.amount).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Trip Operations Button Group */}
          <View style={styles.tripBtnGrid}>
            <TouchableOpacity
              style={styles.milestoneBtn}
              onPress={() => {
                setMilestoneOdo(String(driverVehicle?.odometerKm || ""));
                setMilestoneModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <MapPin size={14} color="#FFF" />
              <Text style={styles.milestoneBtnText}>Rekodi Kituo (Milestone)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeTripBtn}
              onPress={() => {
                setFinalOdo(String(driverVehicle?.odometerKm || ""));
                setCompleteModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <CheckCircle2 size={14} color="#FFF" />
              <Text style={styles.completeTripBtnText}>Funga Safari (Surrender)</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {/* 4. Driver 4 Core Action Dock */}
      <Text style={styles.sectionHeader}>Daily Driver Operations (Huduma za Dereva)</Text>

      <View style={styles.actionGrid}>
        {/* Receipt Snapper */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.primary }]}
          onPress={() => onNavigate("ReceiptSnapper")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.primarySoft }]}>
            <Receipt size={24} color={colors.primary} />
          </View>
          <Text style={styles.actionTitle}>Snap Road Receipt</Text>
          <Text style={styles.actionDesc}>
            Weka risiti ya mafuta, mizani (weighbridge), tozo, au faini papo hapo.
          </Text>
        </TouchableOpacity>

        {/* 60-Sec Walkaround Inspection */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.blue }]}
          onPress={() => onNavigate("PreStartInspection")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.blueSoft }]}>
            <ClipboardCheck size={24} color={colors.blue} />
          </View>
          <Text style={styles.actionTitle}>60-Sec Inspection</Text>
          <Text style={styles.actionDesc}>
            Ukaguzi wa tairi, breki, taa, na mafuta kabla ya kuwasha gari.
          </Text>
        </TouchableOpacity>

        {/* Pair / Switch Truck QR */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.purple }]}
          onPress={() => onNavigate("QrTruckSignIn")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.purpleSoft }]}>
            <QrCode size={24} color={colors.purple} />
          </View>
          <Text style={styles.actionTitle}>QR Truck Coupling</Text>
          <Text style={styles.actionDesc}>
            Scan QR code ya gari au trela unaloliendesha leo.
          </Text>
        </TouchableOpacity>

        {/* Roadside Emergency SOS */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.rose, backgroundColor: colors.roseSoft }]}
          onPress={() => onNavigate("RoadsideSos")}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.rose }]}>
            <Radio size={24} color="#FFF" />
          </View>
          <Text style={[styles.actionTitle, { color: colors.rose }]}>Roadside Emergency SOS</Text>
          <Text style={styles.actionDesc}>
            Uharibifu barabarani? Bonyeza hapa kutuma GPS location kwa karakana mara moja.
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: Log Milestone Checkpoint */}
      <Modal visible={milestoneModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rekodi Kituo cha Safari (Milestone)</Text>
              <TouchableOpacity onPress={() => setMilestoneModalOpen(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Rekodi mzani uliopita, kituo cha mafuta, au mpaka (border post) wa nchi.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Jina la kituo (mf. Mizani ya Vigwaza au Manyoni)"
              placeholderTextColor={colors.textDim}
              value={milestoneName}
              onChangeText={setMilestoneName}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Kilometa za sasa (Odometer KM)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={milestoneOdo}
              onChangeText={setMilestoneOdo}
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleSaveMilestone}
              disabled={savingMilestone}
            >
              {savingMilestone ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Hifadhi Kituo (Save Checkpoint)</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Complete & Surrender Trip */}
      <Modal visible={completeModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kamilisha & Funga Safari (Surrender)</Text>
              <TouchableOpacity onPress={() => setCompleteModalOpen(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Umefika mwisho wa safari? Ingiza kilometa za mwisho kufunga safari na kuwasilisha hesabu ya posho.
            </Text>

            <View style={styles.surrenderSummaryBox}>
              <Text style={styles.surrenderLabel}>Hesabu ya Safari Float:</Text>
              <Text style={styles.surrenderValue}>
                Kiasi cha Kurejesha (Balance to Cashier): TZS {remainingCashBalance.toLocaleString()}
              </Text>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Odometer ya mwisho wakati wa kushusha mzigo (KM)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={finalOdo}
              onChangeText={setFinalOdo}
            />

            <TextInput
              style={[styles.modalInput, { minHeight: 65, textAlignVertical: "top" }]}
              placeholder="Maoni ya safari (hali ya mzigo, barabara, gari)..."
              placeholderTextColor={colors.textDim}
              multiline
              value={closingNotes}
              onChangeText={setClosingNotes}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: colors.emerald }]}
              onPress={handleCompleteTrip}
              disabled={completingTrip}
            >
              {completingTrip ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Funga Safari Sasa (Confirm & Close)</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Start Assigned Trip */}
      <Modal visible={startModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kuanza Safari (Start Trip)</Text>
              <TouchableOpacity onPress={() => setStartModalOpen(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Safari hii imepangwa kutoka {pendingTrip?.origin} kwenda {pendingTrip?.destination}.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Odometer wakati wa kuondoka (Start KM)"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={startingOdo}
              onChangeText={setStartingOdo}
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleStartTrip}
              disabled={startingTrip}
            >
              {startingTrip ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Thibitisha Kuanza Safari</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  greetingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 4,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  greetingName: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },
  orgBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  orgBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },
  truckCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  truckHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  truckLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  truckIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  truckPlate: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
    fontFamily: "monospace",
  },
  truckCode: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  trailerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginTop: 2,
  },
  trailerLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  trailerValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.amber,
    fontFamily: "monospace",
  },
  truckStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  truckStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  unpairBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unpairText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.rose,
  },
  pairPromptCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary + "44",
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pairIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  pairPromptTextContainer: {
    flex: 1,
  },
  pairPromptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  pairPromptSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  pendingCard: {
    backgroundColor: colors.amber + "10",
    borderColor: colors.amber,
    gap: spacing.xs,
  },
  pendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.amber,
  },
  cargoInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  cargoInfoText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  startTripBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginTop: 6,
  },
  startTripBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 13,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderColor: colors.blue + "44",
    gap: spacing.sm,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tripTagText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.blue,
  },
  corridorContainer: {
    gap: 2,
  },
  corridorCities: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
  },
  clientSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  tripMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  tripMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  tripMetaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  walletBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 6,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walletTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  walletTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  walletSurrender: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  walletValuesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  walletSubLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  walletBalanceText: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.emerald,
    marginTop: 1,
  },
  walletSpentText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.amber,
    marginTop: 1,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.amber,
  },
  floatHelperText: {
    fontSize: 10,
    color: colors.textDim,
  },
  receiptsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  receiptsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  addReceiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  addReceiptText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "700",
  },
  emptyReceipts: {
    paddingVertical: spacing.xs,
  },
  emptyReceiptsText: {
    fontSize: 11,
    color: colors.textDim,
    fontStyle: "italic",
  },
  receiptsList: {
    gap: 4,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  receiptRowTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  receiptRowMeta: {
    fontSize: 10,
    color: colors.textMuted,
  },
  receiptRowAmt: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.amber,
  },
  tripBtnGrid: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 6,
  },
  milestoneBtn: {
    flex: 1,
    backgroundColor: colors.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    borderRadius: radii.sm,
  },
  milestoneBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 11,
  },
  completeTripBtn: {
    flex: 1,
    backgroundColor: colors.emerald,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    borderRadius: radii.sm,
  },
  completeTripBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 11,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  actionGrid: {
    gap: spacing.sm,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
    flex: 1,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  surrenderSummaryBox: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.emerald,
    gap: 2,
  },
  surrenderLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  surrenderValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.emerald,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 13,
  },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    marginTop: 4,
  },
  modalSubmitBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 14,
  },
});
