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

  const renderComment = ({ item: comment }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <View style={styles.commentHeader}>
        <Text style={styles.userName}>{comment.userName}</Text>
        <Text style={styles.timestamp}>
          {comment.createdAt.toLocaleDateString()}
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
}); 