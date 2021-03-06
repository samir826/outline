// @flow
import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { observable } from 'mobx';
import { CollectionIcon, PrivateCollectionIcon } from 'outline-icons';
import Collection from 'models/Collection';
import Document from 'models/Document';
import CollectionMenu from 'menus/CollectionMenu';
import UiStore from 'stores/UiStore';
import DocumentsStore from 'stores/DocumentsStore';
import SidebarLink from './SidebarLink';
import DocumentLink from './DocumentLink';
import DropToImport from 'components/DropToImport';
import Flex from 'shared/components/Flex';
import AuthStore from '../../../stores/AuthStore';

type Props = {
  collection: Collection,
  ui: UiStore,
  documents: DocumentsStore,
  activeDocument: ?Document,
  prefetchDocument: (id: string) => Promise<void>,
  auth: AuthStore,
};

@observer
class CollectionLink extends React.Component<Props> {
  @observable menuOpen = false;

  render() {
    const {
      collection,
      documents,
      activeDocument,
      prefetchDocument,
      ui,
      auth,
    } = this.props;
    const expanded = collection.id === ui.activeCollectionId;
    const { user = {} } = auth;
    const isAdmin = user.isAdmin;

    return (
      <DropToImport
        key={collection.id}
        collectionId={collection.id}
        activeClassName="activeDropZone"
      >
        <SidebarLink
          key={collection.id}
          to={collection.url}
          icon={
            collection.private ? (
              <PrivateCollectionIcon
                expanded={expanded}
                color={collection.color}
              />
            ) : (
              <CollectionIcon expanded={expanded} color={collection.color} />
            )
          }
          iconColor={collection.color}
          expanded={expanded}
          hideDisclosure
          menuOpen={this.menuOpen}
          label={collection.name}
          exact={false}
          menu={
            isAdmin ? (
              <CollectionMenu
                position="right"
                collection={collection}
                onOpen={() => (this.menuOpen = true)}
                onClose={() => (this.menuOpen = false)}
              />
            ) : (
              undefined
            )
          }
        >
          <Flex column>
            {collection.documents.map(node => (
              <DocumentLink
                key={node.id}
                node={node}
                documents={documents}
                collection={collection}
                activeDocument={activeDocument}
                prefetchDocument={prefetchDocument}
                depth={1.5}
              />
            ))}
          </Flex>
        </SidebarLink>
      </DropToImport>
    );
  }
}

export default inject('auth')(CollectionLink);
