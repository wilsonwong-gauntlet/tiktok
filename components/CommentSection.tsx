import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Comment } from '../types/video';
import { auth } from '../services/firebase/index';
import {
  addComment,
  getComments,
  likeComment,
  addReply,
  getReplies,
} from '../services/firebase/comments';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface CommentSummaryResponse {
  success: boolean;
  reason?: string;
  summary?: CommentSummary;
}

interface CommentSummary {
  summary: string;
  confusionPoints: string[];
  valuableInsights: string[];
  sentiment: string;
  lastUpdated: Date;
  commentCount: number;
}

interface CommentSectionProps {
  visible: boolean;
  onClose: () => void;
  videoId: string;
}

export default function CommentSection({
  visible,
  onClose,
  videoId,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [commentSummary, setCommentSummary] = useState<CommentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadComments();
    }
  }, [visible]);

  const loadComments = async () => {
    if (!videoId) return;

    try {
      setLoading(true);
      const result = await getComments(videoId);
      setComments(result.comments);
      setLastVisible(result.lastVisible);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!videoId || summaryLoading) return;

    try {
      setError(null);
      setSummaryLoading(true);
      console.log('Starting summary generation for video:', videoId);
      
      const functions = getFunctions();
      console.log('Firebase Functions initialized');
      
      const generateCommentSummary = httpsCallable<{ videoId: string }, CommentSummaryResponse>(
        functions,
        'generateCommentSummary'
      );
      console.log('Cloud function reference created');
      
      console.log('Calling cloud function with videoId:', videoId);
      const result = await generateCommentSummary({ videoId });
      console.log('Cloud function response:', result);
      
      if (result.data.success && result.data.summary) {
        console.log('Summary generated successfully:', result.data.summary);
        setCommentSummary(result.data.summary);
      } else {
        console.log('Function returned error:', result.data.reason);
        setError(result.data.reason || 'Could not generate summary');
      }
    } catch (error: any) {
      console.error('Error generating summary:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        stack: error?.stack,
        error
      });
      
      // Handle Firebase specific errors
      if (error?.code === 'functions/internal') {
        setError('Server error. Please try again in a few minutes.');
      } else if (error?.code === 'functions/unavailable') {
        setError('Service temporarily unavailable. Please try again later.');
      } else if (error?.code === 'functions/unauthenticated') {
        setError('Please sign in to use this feature.');
      } else if (error?.message) {
        setError(error.message);
      } else {
        setError('Failed to generate summary. Please try again later.');
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadMoreComments = async () => {
    if (!videoId || !lastVisible || loadingMore) return;

    try {
      setLoadingMore(true);
      const result = await getComments(videoId, lastVisible);
      setComments([...comments, ...result.comments]);
      setLastVisible(result.lastVisible);
    } catch (error) {
      console.error('Error loading more comments:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAddComment = async () => {
    if (!auth.currentUser || !newComment.trim()) return;

    try {
      await addComment(
        videoId,
        auth.currentUser.uid,
        auth.currentUser.email || 'Anonymous',
        newComment.trim()
      );
      setNewComment('');
      loadComments(); // Reload comments to show the new one
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      await likeComment(commentId);
      // Update the comment in the local state
      setComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? { ...comment, likes: (comment.likes || 0) + 1 }
            : comment
        )
      );
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleAddReply = async () => {
    if (!auth.currentUser || !selectedComment || !replyContent.trim()) return;

    try {
      await addReply(
        selectedComment.id,
        auth.currentUser.uid,
        auth.currentUser.email || 'Anonymous',
        replyContent.trim()
      );
      setReplyContent('');
      setSelectedComment(null);
      loadComments(); // Reload comments to show the new reply
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    try {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString();
      } else if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString();
      }
      return 'Unknown date';
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown date';
    }
  };

  const renderComment = ({ item: comment }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <View style={styles.commentHeader}>
        <Text style={styles.userName}>{comment.userName}</Text>
        <Text style={styles.timestamp}>
          {formatTimestamp(comment.createdAt)}
        </Text>
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
      <View style={styles.commentActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLikeComment(comment.id)}
        >
          <Ionicons name="heart-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{comment.likes || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setSelectedComment(comment)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>
      </View>
      {comment.replies?.map(reply => (
        <View key={reply.id} style={styles.replyContainer}>
          <Text style={styles.replyUserName}>{reply.userName}</Text>
          <Text style={styles.replyContent}>{reply.content}</Text>
        </View>
      ))}
    </View>
  );

  const renderSummarySection = () => {
    if (!commentSummary && !summaryLoading) {
      if (comments.length >= 5) {
        return (
          <View>
            <TouchableOpacity
              style={styles.generateSummaryButton}
              onPress={generateSummary}
            >
              <Ionicons name="analytics-outline" size={20} color="#fff" />
              <Text style={styles.generateSummaryText}>Generate Community Insights</Text>
            </TouchableOpacity>
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color="#ff4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        );
      } else if (comments.length > 0) {
        return (
          <View style={styles.thresholdMessageContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#666" />
            <Text style={styles.thresholdMessageText}>
              Need at least 5 comments to generate insights
            </Text>
          </View>
        );
      }
      return null;
    }

    if (summaryLoading) {
      return (
        <View style={styles.summaryLoadingContainer}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.summaryLoadingText}>Analyzing comments...</Text>
        </View>
      );
    }

    if (!commentSummary) return null;

    return (
      <View style={styles.summaryContainer}>
        <TouchableOpacity
          style={styles.summaryHeader}
          onPress={() => setSummaryExpanded(!summaryExpanded)}
        >
          <View style={styles.summaryHeaderLeft}>
            <Ionicons
              name="analytics"
              size={24}
              color="#fff"
            />
            <Text style={styles.summaryTitle}>Community Insights</Text>
          </View>
          <View style={styles.summaryHeaderRight}>
            <Text style={styles.summaryMeta}>
              {commentSummary.commentCount} comments analyzed
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={generateSummary}
            >
              <Ionicons name="refresh" size={20} color="#666" />
            </TouchableOpacity>
            <Ionicons
              name={summaryExpanded ? "chevron-up" : "chevron-down"}
              size={24}
              color="#666"
            />
          </View>
        </TouchableOpacity>

        {summaryExpanded && (
          <View style={styles.summaryContent}>
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="chatbubbles-outline" size={16} color="#fff" /> Main Discussion
              </Text>
              <Text style={styles.sectionText}>{commentSummary.summary}</Text>
            </View>

            {commentSummary.confusionPoints.length > 0 && (
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="help-circle-outline" size={16} color="#fff" /> Areas of Confusion
                </Text>
                {commentSummary.confusionPoints.map((point, index) => (
                  <Text key={index} style={styles.bulletPoint}>• {point}</Text>
                ))}
              </View>
            )}

            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="bulb-outline" size={16} color="#fff" /> Valuable Insights
              </Text>
              {commentSummary.valuableInsights.map((insight, index) => (
                <Text key={index} style={styles.bulletPoint}>• {insight}</Text>
              ))}
            </View>

            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="heart-outline" size={16} color="#fff" /> Community Engagement
              </Text>
              <Text style={styles.sectionText}>{commentSummary.sentiment}</Text>
            </View>

            <Text style={styles.lastUpdated}>
              Last updated: {formatTimestamp(commentSummary.lastUpdated)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {renderSummarySection()}

          {loading ? (
            <ActivityIndicator style={styles.loading} color="#fff" />
          ) : (
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={item => item.id}
              onEndReached={loadMoreComments}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator style={styles.loading} color="#fff" />
                ) : null
              }
              ListEmptyComponent={
                <Text style={styles.emptyText}>No comments yet</Text>
              }
            />
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor="#666"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Ionicons
                name="send"
                size={24}
                color={newComment.trim() ? '#fff' : '#666'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Reply Modal */}
        <Modal
          visible={!!selectedComment}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedComment(null)}
        >
          <View style={styles.replyModal}>
            <View style={styles.replyModalContent}>
              <View style={styles.replyModalHeader}>
                <Text style={styles.replyModalTitle}>Reply to {selectedComment?.userName}</Text>
                <TouchableOpacity onPress={() => setSelectedComment(null)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.replyInput}
                placeholder="Write a reply..."
                placeholderTextColor="#666"
                value={replyContent}
                onChangeText={setReplyContent}
                multiline
              />
              <TouchableOpacity
                style={[styles.replyButton, !replyContent.trim() && styles.replyButtonDisabled]}
                onPress={handleAddReply}
                disabled={!replyContent.trim()}
              >
                <Text style={styles.replyButtonText}>Send Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  loading: {
    padding: 20,
  },
  commentContainer: {
    marginBottom: 20,
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userName: {
    color: '#fff',
    fontWeight: '600',
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
  },
  commentContent: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#666',
    fontSize: 14,
  },
  replyContainer: {
    marginLeft: 20,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  replyUserName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    marginBottom: 4,
  },
  replyContent: {
    color: '#fff',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
    marginTop: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  replyModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  replyModalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  replyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  replyModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  replyInput: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  replyButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  replyButtonDisabled: {
    opacity: 0.5,
  },
  replyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  summaryMeta: {
    color: '#666',
    fontSize: 12,
  },
  refreshButton: {
    padding: 4,
  },
  summaryContent: {
    padding: 16,
  },
  summarySection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  bulletPoint: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    marginBottom: 4,
  },
  lastUpdated: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  generateSummaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a472a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  generateSummaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  summaryLoadingContainer: {
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  summaryLoadingText: {
    color: '#fff',
    fontSize: 14,
  },
  thresholdMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  thresholdMessageText: {
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
  },
}); 