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
  kpop:      'K-POP',
  hiphop:    '힙합',
  fitness:   '피트니스',
  challenge: '챌린지',
  promotion: '프로모션',
  travel:    '여행',
  daily:     '일상',
  news:      '뉴스',
  english:   '영어',
  kids:      '동화/키즈',
};

const GENRE_COLOR: Record<Template['genre'], string> = {
  kpop:      '#e94560',
  hiphop:    '#9c27b0',
  fitness:   '#4caf50',
  challenge: '#ff5722',
  promotion: '#e91e63',
  travel:    '#00bcd4',
  daily:     '#607d8b',
  news:      '#1565c0',
  english:   '#2196f3',
  kids:      '#ff80ab',
};

const CAMERA_MODE_LABEL: Record<string, string> = {
  selfie: '📱 셀카',
  normal: '📷 일반',
};

const DIFFICULTY_STAR: Record<number, string> = {
  1: '★☆☆',
  2: '★★☆',
  3: '★★★',
};

const MISSION_TYPE_ICONS: Record<string, string> = {
  gesture:    '🤲',
  voice_read: '🎤',
  timing:     '⏱',
  expression: '😊',
};

interface Props {
  template: Template;
  onPress: (template: Template) => void;
}

export function TemplateCard({ template, onPress }: Props) {
  // Collect unique mission types
  const missionTypes = [...new Set(template.missions.map((m) => m.type))];

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(template)} activeOpacity={0.85}>
      {/* Thumbnail or themed placeholder */}
      {template.thumbnail_url ? (
        <Image source={{ uri: template.thumbnail_url }} style={styles.thumbnail} />
      ) : (
        <View
          style={[
            styles.thumbnail,
            styles.placeholderBg,
            { backgroundColor: GENRE_COLOR[template.genre] + '33' },
          ]}
        >
          <Text style={styles.placeholderEmoji}>{template.theme_emoji}</Text>
          <Text style={styles.cameraHint}>{CAMERA_MODE_LABEL[template.camera_mode] ?? ''}</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{template.name}</Text>

        {template.scene ? (
          <Text style={styles.scene} numberOfLines={1}>{template.scene}</Text>
        ) : null}

        <View style={styles.meta}>
          <Text style={[styles.badge, { backgroundColor: GENRE_COLOR[template.genre] }]}>
            {GENRE_LABEL[template.genre] ?? template.genre}
          </Text>
          <Text style={styles.difficulty}>{DIFFICULTY_STAR[template.difficulty]}</Text>
          <Text style={styles.duration}>{template.duration_sec}초</Text>
        </View>

        {/* Mission type icons */}
        <View style={styles.missionRow}>
          {missionTypes.map((t) => (
            <Text key={t} style={styles.missionIcon}>
              {MISSION_TYPE_ICONS[t] ?? '🎯'}
            </Text>
          ))}
          <Text style={styles.bpm}>BPM {template.bpm}</Text>
        </View>
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
    height: 110,
  },
  placeholderBg: {
    backgroundColor: '#16213e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeholderEmoji: {
    fontSize: 34,
  },
  cameraHint: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.8,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    gap: 3,
  },
  name: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  scene: {
    color: '#aaa',
    fontSize: 11,
    fontStyle: 'italic',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    fontWeight: '700',
  },
  difficulty: {
    color: '#ffd700',
    fontSize: 11,
  },
  duration: {
    color: '#aaa',
    fontSize: 11,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  missionIcon: {
    fontSize: 14,
  },
  bpm: {
    color: '#666',
    fontSize: 10,
    marginLeft: 4,
  },
});
