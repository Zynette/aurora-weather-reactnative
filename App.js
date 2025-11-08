// StAuth10244: I Antonette Petallo, 000900501 certify that this material is my original work. No other person's work has been used without due acknowledgement, and I have not made my work available to anyone else.

/**
 * Aurora Weather — React Native + Web API (Open-Meteo)
 * Purpose/target user: quick, readable hourly weather for any city typed by the user.
 * Exceeds minimums: multiple endpoints (city geocoding + forecast), parameterized queries,
 * two hourly modes (temperature-only vs temperature + precipitation probability),
 * recent-search chips, loading + error states, and a polished theme.
 *
 * Web services:
 *  - Geocoding: https://geocoding-api.open-meteo.com/v1/search?name={CITY}&count=5&language=en&format=json
 *  - Forecast:  https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&hourly=...
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// small helper: format hour like "14:00"
const hour = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// map Open-Meteo weathercode → emoji (simple, readable)
const codeToEmoji = (code) => {
  if ([0].includes(code)) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if ([3].includes(code)) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌀";
};

export default function App() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(["Hamilton", "Toronto", "New York"]);
  const [mode, setMode] = useState("basic"); // "basic" = temp only, "precip" = add precipitation prob
  const [cities, setCities] = useState([]);  // results from geocoding endpoint
  const [loadingCity, setLoadingCity] = useState(false);
  const [loadingWx, setLoadingWx] = useState(false);
  const [error, setError] = useState("");

  const [place, setPlace] = useState(null);  // { name, country, lat, lon }
  const [hours, setHours] = useState([]);    // [{ time, temp, code, pop }...]

  // --- actions ----------------------------------------------------------------

  // 1) search city via Open-Meteo geocoding (parameter = user's text input)
  const searchCity = async (text) => {
    const q = (text || query).trim();
    if (!q) return;
    Keyboard.dismiss();
    setLoadingCity(true);
    setError("");
    setCities([]);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=5&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Geocoding failed");
      const data = await res.json();
      setCities((data.results || []).map((r) => ({
        id: `${r.id}`,
        name: r.name,
        country: r.country,
        lat: r.latitude,
        lon: r.longitude,
      })));
      // maintain a small recent list
      setRecent((prev) => {
        const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
        return next;
      });
    } catch (e) {
      setError("City search failed. Check your connection or try a different name.");
    } finally {
      setLoadingCity(false);
    }
  };

  // 2) get forecast for a chosen place (parameter = lat/lon + requested hourly series by mode)
  const fetchWeather = async (p) => {
    if (!p) return;
    setLoadingWx(true);
    setError("");
    setPlace(p);
    setHours([]);
    try {
      const hourly = mode === "precip"
        ? "temperature_2m,precipitation_probability,weathercode"
        : "temperature_2m,weathercode";
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=${hourly}&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Forecast failed");
      const data = await res.json();
      const t = data?.hourly?.time || [];
      const temp = data?.hourly?.temperature_2m || [];
      const code = data?.hourly?.weathercode || [];
      const pop = data?.hourly?.precipitation_probability || [];

      const rows = t.slice(0, 24).map((time, i) => ({
        key: time,
        time,
        temp: temp[i],
        code: code[i],
        pop: pop ? pop[i] : undefined,
      }));
      setHours(rows);
    } catch (e) {
      setError("Could not load forecast. Please try again.");
    } finally {
      setLoadingWx(false);
    }
  };

  // when user switches mode, refetch current place with new hourly parameter
  useEffect(() => {
    if (place) fetchWeather(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // --- UI helpers -------------------------------------------------------------

  const ModeChip = ({ value, label }) => (
    <Pressable
      onPress={() => setMode(value)}
      style={[styles.chip, mode === value && styles.chipActive]}
    >
      <Text style={[styles.chipText, mode === value && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  const CityItem = ({ item }) => (
    <Pressable style={styles.cityRow} onPress={() => fetchWeather(item)}>
      <Text style={styles.cityName}>{item.name}</Text>
      <Text style={styles.cityMeta}>{item.country} · {item.lat.toFixed(2)}, {item.lon.toFixed(2)}</Text>
    </Pressable>
  );

  const HourRow = ({ item }) => (
    <View style={styles.hourRow}>
      <Text style={styles.hourTime}>{hour(item.time)}</Text>
      <Text style={styles.hourEmoji}>{codeToEmoji(item.code)}</Text>
      <Text style={styles.hourTemp}>{Math.round(item.temp)}°</Text>
      {mode === "precip" && (
        <Text style={styles.hourPop}>{item.pop ?? 0}%</Text>
      )}
    </View>
  );

  // --- render -----------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner image satisfies "at least one image" */}
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?q=80&w=1200&auto=format&fit=crop" }}
          style={styles.hero}
          resizeMode="cover"
        />

        <Text style={styles.title}>Aurora Weather</Text>
        <Text style={styles.subtitle}>
          Fast hourly weather for any city. Type a city and pick a result.
        </Text>

        {/* Search bar + actions (TextInput + Buttons) */}
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Search city… (e.g., Hamilton)"
            placeholderTextColor="#9fb8ad"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => searchCity()}
            style={styles.input}
            returnKeyType="search"
          />
          <Pressable style={styles.btn} onPress={() => searchCity()}>
            <Text style={styles.btnText}>Search</Text>
          </Pressable>
        </View>

        {/* mode chips = changes the API hourly parameter */}
        <View style={styles.rowBetween}>
          <Text style={styles.section}>Hourly mode</Text>
          <View style={styles.chips}>
            <ModeChip value="basic" label="Temp" />
            <ModeChip value="precip" label="Temp+Precip" />
          </View>
        </View>

        {/* Recent search chips */}
        {recent.length > 0 && (
          <View style={styles.recentWrap}>
            <FlatList
              horizontal
              data={recent}
              keyExtractor={(it) => it}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable style={styles.recentChip} onPress={() => { setQuery(item); searchCity(item); }}>
                  <Text style={styles.recentText}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* City results list */}
        {loadingCity ? (
          <View style={styles.loading}><ActivityIndicator color="#b8ffe4" /></View>
        ) : (
          cities.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.section}>Select a place</Text>
              <FlatList
                data={cities}
                renderItem={CityItem}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
              />
            </View>
          )
        )}

        {/* Forecast list */}
        {place && (
          <View style={styles.card}>
            <Text style={styles.section}>
              {place.name}, {place.country} — Next 24 hours
            </Text>

            {loadingWx ? (
              <View style={styles.loading}><ActivityIndicator color="#b8ffe4" /></View>
            ) : (
              <FlatList
                data={hours}
                renderItem={HourRow}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
              />
            )}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.footer}>
          Built with React Native (TextInput, Buttons, FlatList, Image) and Open-Meteo APIs.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- styles (distinct aurora theme) -------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#081416" },
  container: { padding: 16, paddingBottom: 40 },
  hero: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#113238",
  },
  title: { color: "#e9fffb", fontWeight: "800", fontSize: 28, letterSpacing: 0.3 },
  subtitle: { color: "#9fb8ad", marginTop: 4 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  input: {
    flex: 1,
    backgroundColor: "#102427",
    color: "#dbfffa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#14363c",
  },
  btn: {
    backgroundColor: "#35c29a",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 12,
  },
  btnText: { color: "#06201d", fontWeight: "800" },
  rowBetween: { marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  section: { color: "#b8ffe4", fontWeight: "700" },
  chips: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#1b3f45" },
  chipActive: { backgroundColor: "#14363c" },
  chipText: { color: "#9fb8ad", fontWeight: "700" },
  chipTextActive: { color: "#dbfffa" },
  recentWrap: { marginTop: 10 },
  recentChip: {
    backgroundColor: "#0f2b2f",
    borderWidth: 1,
    borderColor: "#184047",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
  },
  recentText: { color: "#bfeee4", fontWeight: "700" },
  card: {
    marginTop: 16,
    backgroundColor: "#0b1f22",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#113238",
    padding: 12,
  },
  cityRow: { paddingVertical: 10 },
  cityName: { color: "#e6fffb", fontSize: 16, fontWeight: "700" },
  cityMeta: { color: "#93beb3", marginTop: 2 },
  sep: { height: 1, backgroundColor: "#13333933" },
  hourRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  hourTime: { color: "#d9fffb", width: 70, fontVariant: ["tabular-nums"] },
  hourEmoji: { width: 40, textAlign: "center", fontSize: 20 },
  hourTemp: { color: "#e6fffb", fontWeight: "800", width: 60 },
  hourPop: { color: "#9fd2ff", marginLeft: 6, fontVariant: ["tabular-nums"] },
  loading: { paddingVertical: 16, alignItems: "center" },
  error: { color: "#ffb4b4", marginTop: 12, fontWeight: "700" },
  footer: { color: "#7fb8ad", marginTop: 18, textAlign: "center" },
});