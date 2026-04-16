import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import type { Template } from '../../types/template';

const GENRE_LABEL: Record<Template['genre'], string> = {
  kpop: 'K-POP',
  hiphop: '힙합',
  fitness: '피트니스',
  challenge: '챌린지',
  promotion: '프로모션',
};

const DIFFICULTY_STAR: Record<number, string> = {
  1: '★☆☆',
  2: '★★☆',
  3: '★★★',
};

interface Props {
  template: Template;
  onPress: (template: Template) => void;
}

export function TemplateCard({ template, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(template)} activeOpacity={0.85}>
      {template.thumbnail_url ? (
        <Image source={{ uri: template.thumbnail_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.placeholderBg]}>
          <Text style={styles.placeholderText}>🎬</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{template.name}</Text>
        <View style={styles.meta}>
          <Text style={styles.badge}>{GENRE_LABEL[template.genre]}</Text>
          <Text style={styles.difficulty}>{DIFFICULTY_STAR[template.difficulty]}</Text>
          <Text style={styles.duration}>{template.duration_sec}초</Text>
        </View>
        <Text style={styles.bpm}>BPM {template.bpm} · {template.missions.length}개 미션</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    elevation: 4,
  },
  thumbnail: {
    width: 90,
    height: 90,
  },
  placeholderBg: {
    backgroundColor: '#16213e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#e94560',
    color: '#fff',
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  difficulty: {
    color: '#ffd700',
    fontSize: 12,
  },
  duration: {
    color: '#aaa',
    fontSize: 12,
  },
  bpm: {
    color: '#888',
    fontSize: 11,
  },
});
